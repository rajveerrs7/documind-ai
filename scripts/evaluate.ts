// ─────────────────────────────────────────────────────────────────────────────
// RAG Evaluation Script
//
// Evaluates the quality of the RAG pipeline against predefined Q&A pairs.
//
// Metrics computed:
//   1. Precision@K — What fraction of retrieved chunks are relevant?
//      - A chunk is "relevant" if it contains keywords from the answer
//      - Precision@4 = relevant chunks / total retrieved chunks (4)
//
//   2. Answer Groundedness — Is the answer based on the retrieved context?
//      - Checks if answer keywords appear in the retrieved chunks
//      - Binary metric: grounded (1) or not grounded (0)
//
//   3. Answer Relevance — Does the answer address the question?
//      - Heuristic: checks if question keywords appear in the answer
//      - Binary metric: relevant (1) or not relevant (0)
//
// Usage:
//   npx tsx scripts/evaluate.ts
//
// Prerequisites:
//   - A test document must be uploaded and processed (READY status)
//   - Set TEST_DOCUMENT_ID and TEST_USER_ID in this script
//   - All environment variables must be set in .env
//
// The script will output a detailed evaluation report to the console
// and save results to /scripts/eval-results.json
// ─────────────────────────────────────────────────────────────────────────────

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

// ── Import LangChain modules directly ─────────────────────────────────────────
// We import directly to avoid Next.js server context requirements

import { searchSimilarChunks } from "../lib/langchain/vector-store";
import { runRagPipelineSync } from "../lib/langchain/chains";

// ── Configuration ─────────────────────────────────────────────────────────────

// ⚠️ IMPORTANT: Set these values before running the evaluation
// These should be real IDs from your database
const TEST_USER_ID = process.env.EVAL_USER_ID || "REPLACE_WITH_REAL_USER_ID";
const TEST_DOCUMENT_ID =
  process.env.EVAL_DOCUMENT_ID || "REPLACE_WITH_REAL_DOCUMENT_ID";

// Number of chunks to retrieve per query
const TOP_K = 4;

// ── Test Q&A Pairs ────────────────────────────────────────────────────────────
// These are predefined questions with expected answer keywords.
// The keywords are used for relevance checking — the answer doesn't need
// to be word-for-word identical, just contain these key concepts.
//
// Customize these for your test document!
const QA_PAIRS: Array<{
  id: string;
  question: string;
  // Keywords that should appear in relevant chunks and good answers
  answerKeywords: string[];
  // Optional: keywords that MUST appear in retrieved chunks to be "relevant"
  relevantChunkKeywords: string[];
  // Category for grouping results
  category: string;
}> = [
  {
    id: "Q1",
    question: "What is the main purpose of this document?",
    answerKeywords: ["purpose", "objective", "goal", "aim", "describe"],
    relevantChunkKeywords: ["introduction", "overview", "purpose", "abstract"],
    category: "General",
  },
  {
    id: "Q2",
    question: "What are the key findings or conclusions?",
    answerKeywords: ["finding", "conclusion", "result", "summary", "key"],
    relevantChunkKeywords: ["conclusion", "finding", "result", "summary"],
    category: "Content",
  },
  {
    id: "Q3",
    question: "Are there any specific dates or timeframes mentioned?",
    answerKeywords: ["date", "year", "month", "period", "timeframe", "when"],
    relevantChunkKeywords: ["date", "year", "time", "period", "schedule"],
    category: "Factual",
  },
  {
    id: "Q4",
    question: "What methodology or approach is described?",
    answerKeywords: ["method", "approach", "process", "procedure", "technique"],
    relevantChunkKeywords: ["method", "approach", "methodology", "process"],
    category: "Methodology",
  },
  {
    id: "Q5",
    question: "Who are the key people or organizations mentioned?",
    answerKeywords: ["author", "organization", "team", "company", "person"],
    relevantChunkKeywords: ["author", "organization", "company", "team"],
    category: "Entities",
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChunkEvaluationResult {
  chunkIndex: number;
  content: string;
  page: number;
  score: number;
  isRelevant: boolean; // Does it contain relevant keywords?
}

interface QuestionEvaluationResult {
  id: string;
  question: string;
  category: string;
  answer: string;
  retrievedChunks: ChunkEvaluationResult[];
  precisionAtK: number; // Fraction of retrieved chunks that are relevant
  isGrounded: boolean; // Does answer use context (not hallucinated)?
  isRelevant: boolean; // Does answer address the question?
  retrievalTimeMs: number;
  generationTimeMs: number;
  totalTimeMs: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

interface EvaluationReport {
  timestamp: string;
  documentId: string;
  userId: string;
  totalQuestions: number;
  avgPrecisionAtK: number;
  groundednessRate: number; // % of answers grounded in context
  relevanceRate: number; // % of answers relevant to question
  avgRetrievalTimeMs: number;
  avgGenerationTimeMs: number;
  avgTotalTimeMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  results: QuestionEvaluationResult[];
  categoryBreakdown: Record<
    string,
    {
      avgPrecision: number;
      groundednessRate: number;
      count: number;
    }
  >;
}

// ── Evaluation Helpers ────────────────────────────────────────────────────────

/**
 * Checks if a text contains any of the given keywords (case-insensitive).
 *
 * @param text - Text to search in
 * @param keywords - Keywords to look for
 * @returns true if any keyword is found
 */
function containsKeywords(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Calculates Precision@K for a set of retrieved chunks.
 *
 * Precision@K = |relevant chunks in top K| / K
 *
 * A chunk is considered "relevant" if it contains any of the
 * specified relevantChunkKeywords.
 *
 * @param chunks - Retrieved chunks with content
 * @param relevantKeywords - Keywords that indicate relevance
 * @param k - Number of chunks retrieved (K)
 * @returns Precision score (0.0 to 1.0)
 */
function calculatePrecisionAtK(
  chunks: Array<{ content: string; score: number }>,
  relevantKeywords: string[],
  k: number,
): { precision: number; relevantChunks: boolean[] } {
  const topK = chunks.slice(0, k);
  const relevantFlags = topK.map((chunk) =>
    containsKeywords(chunk.content, relevantKeywords),
  );

  const relevantCount = relevantFlags.filter(Boolean).length;
  const precision = k > 0 ? relevantCount / k : 0;

  return { precision, relevantChunks: relevantFlags };
}

/**
 * Checks if an answer is grounded in the retrieved context.
 *
 * Groundedness = the answer uses information from the chunks,
 * not external knowledge.
 *
 * Heuristic: check if answer keywords appear in the retrieved chunks.
 * A proper implementation would use an LLM to verify this.
 *
 * @param answer - Generated answer
 * @param chunks - Retrieved context chunks
 * @param answerKeywords - Keywords expected in a good answer
 * @returns true if answer appears to be grounded
 */
function checkGroundedness(
  answer: string,
  chunks: Array<{ content: string }>,
  answerKeywords: string[],
): boolean {
  // Case 1: The answer explicitly says it doesn't know
  // (this IS grounded behavior when context lacks the answer)
  const doesntKnowPhrases = [
    "don't have",
    "do not have",
    "not found",
    "not mentioned",
    "not provided",
    "cannot find",
    "no information",
    "insufficient",
    "unclear",
  ];

  if (containsKeywords(answer, doesntKnowPhrases)) {
    return true; // Correctly declined to hallucinate
  }

  // Case 2: The answer keywords appear in the retrieved chunks
  // (means the answer is using context, not hallucinating)
  const combinedChunkText = chunks.map((c) => c.content).join(" ");
  const answerKeywordsInChunks = answerKeywords.filter((keyword) =>
    containsKeywords(combinedChunkText, [keyword]),
  );

  // Consider grounded if at least 30% of answer keywords appear in chunks
  const groundednessThreshold = 0.3;
  const groundednessScore =
    answerKeywords.length > 0
      ? answerKeywordsInChunks.length / answerKeywords.length
      : 0;

  return groundednessScore >= groundednessThreshold;
}

/**
 * Checks if an answer is relevant to the question.
 *
 * Relevance = the answer addresses what was asked.
 *
 * Heuristic: check if question keywords appear in the answer.
 *
 * @param answer - Generated answer
 * @param questionKeywords - Keywords from the expected answer
 * @returns true if answer appears relevant
 */
function checkRelevance(answer: string, questionKeywords: string[]): boolean {
  // If answer is very short, likely not relevant
  if (answer.trim().length < 20) return false;

  // If answer says it doesn't know, that's a valid but less-relevant response
  const doesntKnow = containsKeywords(answer, [
    "don't have",
    "not mentioned",
    "not provided",
    "no information",
  ]);

  if (doesntKnow) return true; // Correctly declined

  // Check if answer contains some of the expected keywords
  const keywordsInAnswer = questionKeywords.filter((kw) =>
    containsKeywords(answer, [kw]),
  );

  return keywordsInAnswer.length > 0;
}

// ── Main Evaluation Function ──────────────────────────────────────────────────

async function evaluateQuestion(
  qa: (typeof QA_PAIRS)[0],
): Promise<QuestionEvaluationResult> {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`📋 Evaluating: [${qa.id}] ${qa.question}`);

  const startTotal = Date.now();

  try {
    // ── Step 1: Retrieve chunks ──────────────────────────────
    console.log(`   🔍 Retrieving top-${TOP_K} chunks...`);
    const startRetrieval = Date.now();

    const retrievedChunks = await searchSimilarChunks(
      qa.question,
      TEST_USER_ID,
      TEST_DOCUMENT_ID,
      TOP_K,
    );

    const retrievalTimeMs = Date.now() - startRetrieval;
    console.log(
      `   ✓ Retrieved ${retrievedChunks.length} chunks in ${retrievalTimeMs}ms`,
    );

    // ── Step 2: Evaluate chunk relevance ─────────────────────
    const { precision, relevantChunks } = calculatePrecisionAtK(
      retrievedChunks.map((c) => ({ content: c.content, score: c.score })),
      qa.relevantChunkKeywords,
      TOP_K,
    );

    console.log(`   📊 Precision@${TOP_K}: ${(precision * 100).toFixed(0)}%`);

    // ── Step 3: Generate answer ──────────────────────────────
    console.log(`   🤖 Generating answer via Groq...`);
    const startGeneration = Date.now();

    const ragResult = await runRagPipelineSync(
      qa.question,
      TEST_USER_ID,
      TEST_DOCUMENT_ID,
    );

    const generationTimeMs = Date.now() - startGeneration;
    console.log(
      `   ✓ Generated answer in ${generationTimeMs}ms ` +
        `(${ragResult.usage.inputTokens} in / ${ragResult.usage.outputTokens} out tokens)`,
    );

    // ── Step 4: Check groundedness ───────────────────────────
    const isGrounded = checkGroundedness(
      ragResult.answer,
      retrievedChunks.map((c) => ({ content: c.content })),
      qa.answerKeywords,
    );
    console.log(`   🔗 Grounded: ${isGrounded ? "✅ YES" : "❌ NO"}`);

    // ── Step 5: Check relevance ──────────────────────────────
    const isRelevant = checkRelevance(ragResult.answer, qa.answerKeywords);
    console.log(`   🎯 Relevant: ${isRelevant ? "✅ YES" : "❌ NO"}`);

    // ── Step 6: Log answer preview ───────────────────────────
    const answerPreview = ragResult.answer.slice(0, 200);
    console.log(
      `   💬 Answer preview: "${answerPreview}${ragResult.answer.length > 200 ? "..." : ""}"`,
    );

    const totalTimeMs = Date.now() - startTotal;

    // Build chunk evaluation results
    const chunkResults: ChunkEvaluationResult[] = retrievedChunks.map(
      (chunk, i) => ({
        chunkIndex: i,
        content: chunk.content.slice(0, 300),
        page: (chunk.metadata.page as number) || 0,
        score: chunk.score,
        isRelevant: relevantChunks[i] || false,
      }),
    );

    return {
      id: qa.id,
      question: qa.question,
      category: qa.category,
      answer: ragResult.answer,
      retrievedChunks: chunkResults,
      precisionAtK: precision,
      isGrounded,
      isRelevant,
      retrievalTimeMs,
      generationTimeMs,
      totalTimeMs,
      inputTokens: ragResult.usage.inputTokens,
      outputTokens: ragResult.usage.outputTokens,
    };
  } catch (error) {
    console.error(`   ❌ Error evaluating question: ${error}`);

    return {
      id: qa.id,
      question: qa.question,
      category: qa.category,
      answer: "",
      retrievedChunks: [],
      precisionAtK: 0,
      isGrounded: false,
      isRelevant: false,
      retrievalTimeMs: 0,
      generationTimeMs: 0,
      totalTimeMs: Date.now() - startTotal,
      inputTokens: 0,
      outputTokens: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ── Report Generator ──────────────────────────────────────────────────────────

function generateReport(results: QuestionEvaluationResult[]): EvaluationReport {
  const successfulResults = results.filter((r) => !r.error);
  const n = successfulResults.length;

  // Calculate aggregate metrics
  const avgPrecisionAtK =
    n > 0 ? successfulResults.reduce((s, r) => s + r.precisionAtK, 0) / n : 0;

  const groundednessRate =
    n > 0 ? successfulResults.filter((r) => r.isGrounded).length / n : 0;

  const relevanceRate =
    n > 0 ? successfulResults.filter((r) => r.isRelevant).length / n : 0;

  const avgRetrievalTimeMs =
    n > 0
      ? successfulResults.reduce((s, r) => s + r.retrievalTimeMs, 0) / n
      : 0;

  const avgGenerationTimeMs =
    n > 0
      ? successfulResults.reduce((s, r) => s + r.generationTimeMs, 0) / n
      : 0;

  const avgTotalTimeMs =
    n > 0 ? successfulResults.reduce((s, r) => s + r.totalTimeMs, 0) / n : 0;

  const avgInputTokens =
    n > 0 ? successfulResults.reduce((s, r) => s + r.inputTokens, 0) / n : 0;

  const avgOutputTokens =
    n > 0 ? successfulResults.reduce((s, r) => s + r.outputTokens, 0) / n : 0;

  // Category breakdown
  const categories = [...new Set(results.map((r) => r.category))];
  const categoryBreakdown: EvaluationReport["categoryBreakdown"] = {};

  for (const category of categories) {
    const catResults = successfulResults.filter((r) => r.category === category);
    const catN = catResults.length;

    categoryBreakdown[category] = {
      avgPrecision:
        catN > 0
          ? catResults.reduce((s, r) => s + r.precisionAtK, 0) / catN
          : 0,
      groundednessRate:
        catN > 0 ? catResults.filter((r) => r.isGrounded).length / catN : 0,
      count: catN,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    documentId: TEST_DOCUMENT_ID,
    userId: TEST_USER_ID,
    totalQuestions: results.length,
    avgPrecisionAtK,
    groundednessRate,
    relevanceRate,
    avgRetrievalTimeMs,
    avgGenerationTimeMs,
    avgTotalTimeMs,
    avgInputTokens,
    avgOutputTokens,
    results,
    categoryBreakdown,
  };
}

// ── Console Report Printer ─────────────────────────────────────────────────────

function printReport(report: EvaluationReport): void {
  console.log("\n");
  console.log("═".repeat(70));
  console.log("  DocuMind AI — RAG Evaluation Report");
  console.log("═".repeat(70));
  console.log(`  Document ID : ${report.documentId}`);
  console.log(`  User ID     : ${report.userId}`);
  console.log(`  Timestamp   : ${report.timestamp}`);
  console.log(`  Questions   : ${report.totalQuestions}`);
  console.log("─".repeat(70));

  // Overall metrics
  console.log("\n  📊 OVERALL METRICS");
  console.log("─".repeat(70));
  console.log(
    `  Precision@${TOP_K}          : ${(report.avgPrecisionAtK * 100).toFixed(1)}%`,
  );
  console.log(
    `  Groundedness Rate       : ${(report.groundednessRate * 100).toFixed(1)}%`,
  );
  console.log(
    `  Answer Relevance Rate   : ${(report.relevanceRate * 100).toFixed(1)}%`,
  );
  console.log("─".repeat(70));
  console.log(
    `  Avg Retrieval Time      : ${report.avgRetrievalTimeMs.toFixed(0)}ms`,
  );
  console.log(
    `  Avg Generation Time     : ${report.avgGenerationTimeMs.toFixed(0)}ms`,
  );
  console.log(
    `  Avg Total Time          : ${report.avgTotalTimeMs.toFixed(0)}ms`,
  );
  console.log("─".repeat(70));
  console.log(
    `  Avg Input Tokens        : ${report.avgInputTokens.toFixed(0)}`,
  );
  console.log(
    `  Avg Output Tokens       : ${report.avgOutputTokens.toFixed(0)}`,
  );
  console.log(
    `  Avg Total Tokens        : ${(report.avgInputTokens + report.avgOutputTokens).toFixed(0)}`,
  );

  // Category breakdown
  console.log("\n  📂 CATEGORY BREAKDOWN");
  console.log("─".repeat(70));
  for (const [category, data] of Object.entries(report.categoryBreakdown)) {
    console.log(
      `  ${category.padEnd(20)} | Precision: ${(data.avgPrecision * 100).toFixed(0)}% | Grounded: ${(data.groundednessRate * 100).toFixed(0)}% | N=${data.count}`,
    );
  }

  // Per-question results
  console.log("\n  📋 QUESTION RESULTS");
  console.log("─".repeat(70));
  for (const result of report.results) {
    const status = result.error ? "❌ ERROR" : "✅ OK";
    const precision = `P@${TOP_K}=${(result.precisionAtK * 100).toFixed(0)}%`;
    const grounded = result.isGrounded ? "🔗✓" : "🔗✗";
    const relevant = result.isRelevant ? "🎯✓" : "🎯✗";

    console.log(
      `  [${result.id}] ${status} ${grounded} ${relevant} ${precision} — ${result.question.slice(0, 40)}...`,
    );

    if (result.error) {
      console.log(`       ⚠️  Error: ${result.error}`);
    }
  }

  // Interpretation guide
  console.log("\n  📖 METRIC GUIDE");
  console.log("─".repeat(70));
  console.log(
    "  Precision@K    : % of retrieved chunks containing relevant content",
  );
  console.log("  Groundedness   : % of answers based on retrieved context");
  console.log("  Relevance      : % of answers addressing the question");
  console.log("\n  Target thresholds for production:");
  console.log("    Precision@4  ≥ 0.50 (50% of chunks relevant)");
  console.log("    Groundedness ≥ 0.80 (80% answers use context)");
  console.log("    Relevance    ≥ 0.75 (75% answers address question)");
  console.log("═".repeat(70));
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀 DocuMind AI — RAG Evaluation Starting...\n");
  console.log(`📄 Document ID  : ${TEST_DOCUMENT_ID}`);
  console.log(`👤 User ID      : ${TEST_USER_ID}`);
  console.log(`❓ Questions    : ${QA_PAIRS.length}`);
  console.log(`🔢 Top-K        : ${TOP_K}`);

  // ── Validate configuration ─────────────────────────────────
  if (
    TEST_DOCUMENT_ID === "REPLACE_WITH_REAL_DOCUMENT_ID" ||
    TEST_USER_ID === "REPLACE_WITH_REAL_USER_ID"
  ) {
    console.error(
      "\n❌ Error: Please set TEST_DOCUMENT_ID and TEST_USER_ID in the script",
    );
    console.error(
      "   Or set EVAL_USER_ID and EVAL_DOCUMENT_ID environment variables\n",
    );
    process.exit(1);
  }

  // ── Validate environment ───────────────────────────────────
  if (!process.env.GROQ_API_KEY) {
    console.error("\n❌ Error: GROQ_API_KEY not set in environment");
    process.exit(1);
  }

  if (!process.env.HUGGINGFACEHUB_API_KEY) {
    console.error("\n❌ Error: HUGGINGFACEHUB_API_KEY not set in environment");
    process.exit(1);
  }

  // ── Run evaluations sequentially ──────────────────────────
  // Sequential (not parallel) to avoid rate limiting
  const results: QuestionEvaluationResult[] = [];

  for (const qa of QA_PAIRS) {
    const result = await evaluateQuestion(qa);
    results.push(result);

    // Small delay between questions to respect rate limits
    if (qa !== QA_PAIRS[QA_PAIRS.length - 1]) {
      console.log("   ⏳ Waiting 3s before next question (rate limit)...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // ── Generate report ────────────────────────────────────────
  const report = generateReport(results);

  // ── Print to console ───────────────────────────────────────
  printReport(report);

  // ── Save to file ───────────────────────────────────────────
  const outputPath = path.join(process.cwd(), "scripts", "eval-results.json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);

  // ── Exit with appropriate code ─────────────────────────────
  const allPassed =
    report.avgPrecisionAtK >= 0.5 &&
    report.groundednessRate >= 0.8 &&
    report.relevanceRate >= 0.75;

  if (allPassed) {
    console.log("\n✅ All evaluation thresholds met!\n");
    process.exit(0);
  } else {
    console.log(
      "\n⚠️  Some evaluation thresholds not met. Review results above.\n",
    );
    process.exit(1);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error("\n❌ Evaluation failed with fatal error:", error);
  process.exit(1);
});
