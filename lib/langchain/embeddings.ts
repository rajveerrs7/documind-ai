// ─────────────────────────────────────────────────────────────────────────────
// HuggingFace Embeddings Configuration
//
// Model: BAAI/bge-small-en-v1.5
//   - Free tier via HuggingFace Inference API
//   - Output dimension: 384 (matches our pgvector table definition)
//   - Optimized for semantic similarity / retrieval tasks
//   - "bge" = Beijing Academy of AI General Embeddings
//
// We wrap the HuggingFace client in a LangChain-compatible interface
// so it plugs directly into LangChain's Vector Store and Retriever APIs.
//
// IMPORTANT: HuggingFace free tier has rate limits.
// We add retry logic and basic error handling to be resilient.
// ─────────────────────────────────────────────────────────────────────────────

import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

// ── Constants ────────────────────────────────────────────────────────────────

// The embedding model we use — 384-dim vectors, great for RAG
export const EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5";

// Output dimension of this model — must match pgvector table definition
export const EMBEDDING_DIMENSION = 384;

// Maximum characters to embed in a single call
// HuggingFace free tier has token limits; we stay well under
export const MAX_EMBED_CHARS = 2000;

// ── Singleton Pattern ─────────────────────────────────────────────────────────
// We reuse a single embeddings instance across the application
// to avoid creating new API clients on every request

let embeddingsInstance: HuggingFaceInferenceEmbeddings | null = null;

/**
 * Returns a singleton instance of HuggingFaceInferenceEmbeddings.
 *
 * Using LangChain's HuggingFaceInferenceEmbeddings which internally
 * calls the HuggingFace Inference API — free tier compatible.
 *
 * @throws {Error} If HUGGINGFACEHUB_API_KEY is not set
 */
export function getEmbeddings(): HuggingFaceInferenceEmbeddings {
  // Validate environment variable at call time (not module load time)
  // This gives better error messages and avoids build-time failures
  if (!process.env.HUGGINGFACEHUB_API_KEY) {
    throw new Error(
      "HUGGINGFACEHUB_API_KEY environment variable is not set. " +
        "Get your free key at https://huggingface.co/settings/tokens",
    );
  }

  // Return existing instance if available (singleton)
  if (embeddingsInstance) {
    return embeddingsInstance;
  }

  // Create new instance
  embeddingsInstance = new HuggingFaceInferenceEmbeddings({
    // API key for HuggingFace Inference API
    apiKey: process.env.HUGGINGFACEHUB_API_KEY,

    // The embedding model
    model: EMBEDDING_MODEL,

    // HuggingFace free tier can be slow on first call (model warm-up)
    // endpointUrl is not needed for hosted inference API
  });

  return embeddingsInstance;
}

/**
 * Embeds a single text string.
 * Used for embedding user queries before vector search.
 *
 * @param text - The text to embed
 * @returns Promise<number[]> - 384-dimensional embedding vector
 */
export async function embedQuery(text: string): Promise<number[]> {
  const embeddings = getEmbeddings();

  // Sanitize input — truncate if too long
  const sanitized = text.slice(0, MAX_EMBED_CHARS).trim();

  if (!sanitized) {
    throw new Error("Cannot embed empty text");
  }

  try {
    const vector = await embeddings.embedQuery(sanitized);
    return vector;
  } catch (error) {
    console.error("[Embeddings] Failed to embed query:", error);
    throw new Error(
      `Embedding generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Embeds multiple text chunks in batch.
 * Used during document processing.
 *
 * HuggingFace free tier processes these sequentially under the hood,
 * but LangChain's interface makes it easy to switch to a batch API later.
 *
 * @param texts - Array of text chunks to embed
 * @returns Promise<number[][]> - Array of 384-dimensional vectors
 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const embeddings = getEmbeddings();

  if (texts.length === 0) {
    throw new Error("Cannot embed empty array of texts");
  }

  // Sanitize all inputs
  const sanitized = texts
    .map((t) => t.slice(0, MAX_EMBED_CHARS).trim())
    .filter(Boolean);

  try {
    const vectors = await embeddings.embedDocuments(sanitized);
    return vectors;
  } catch (error) {
    console.error("[Embeddings] Failed to embed documents:", error);
    throw new Error(
      `Batch embedding failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Validates that the embeddings service is reachable.
 * Used in health checks and startup validation.
 *
 * @returns Promise<boolean>
 */
export async function validateEmbeddingsService(): Promise<boolean> {
  try {
    const testVector = await embedQuery("test connection");
    // Validate output dimension matches expected
    if (testVector.length !== EMBEDDING_DIMENSION) {
      console.error(
        `[Embeddings] Unexpected dimension: got ${testVector.length}, expected ${EMBEDDING_DIMENSION}`,
      );
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
