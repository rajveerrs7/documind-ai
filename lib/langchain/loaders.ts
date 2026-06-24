// ─────────────────────────────────────────────────────────────────────────────
// Document Loaders & Text Splitters
//
// Pipeline:
//   1. Load PDF using LangChain's PDFLoader (wraps pdf-parse)
//   2. Clean extracted text (remove artifacts, normalize whitespace)
//   3. Split into chunks using RecursiveCharacterTextSplitter
//      - Chunk size: 500 chars (small = fits Groq 8K context with 4 chunks)
//      - Overlap: 100 chars (preserves context across chunk boundaries)
//   4. Return enriched LangChain Document objects
//
// Why small chunks?
//   - Groq llama3-8b-8192 has 8192 token context window
//   - Each chunk ~500 chars ≈ ~125 tokens
//   - 4 chunks = ~500 tokens for context
//   - Leaves ~7500 tokens for system prompt + query + response
//
// Why RecursiveCharacterTextSplitter?
//   - Tries to split on natural boundaries: \n\n, \n, space, then chars
//   - Produces more coherent chunks than naive character splitting
// ─────────────────────────────────────────────────────────────────────────────

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Document } from "@langchain/core/documents";
import * as fs from "fs";
import * as path from "path";

// ── Chunking Configuration ────────────────────────────────────────────────────

export const CHUNK_SIZE = 500; // characters per chunk
export const CHUNK_OVERLAP = 100; // overlap between consecutive chunks

// Maximum file size we'll process (10MB = 10 * 1024 * 1024 bytes)
export const MAX_FILE_SIZE = parseInt(
  process.env.MAX_FILE_SIZE_BYTES || "10485760",
);

// ── Text Cleaning ─────────────────────────────────────────────────────────────

/**
 * Cleans raw text extracted from PDFs.
 *
 * PDF extraction often produces:
 *   - Multiple consecutive newlines (from page headers/footers)
 *   - Excessive whitespace
 *   - Hyphenated line breaks (word-\nwrap)
 *   - Page numbers / headers we don't want in embeddings
 *   - Unicode artifacts
 *
 * @param text - Raw text from PDF parser
 * @returns Cleaned text string
 */
export function cleanPdfText(text: string): string {
  return (
    text
      // Fix hyphenated line breaks (e.g., "compre-\nhensive" → "comprehensive")
      .replace(/(\w)-\n(\w)/g, "$1$2")
      // Replace multiple consecutive newlines with double newline (paragraph break)
      .replace(/\n{3,}/g, "\n\n")
      // Replace multiple spaces/tabs with single space
      .replace(/[ \t]{2,}/g, " ")
      // Remove null bytes and other control characters (except newlines)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Normalize Unicode whitespace
      .replace(/\u00A0/g, " ") // Non-breaking space → regular space
      // Trim leading/trailing whitespace from each line
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      // Final trim
      .trim()
  );
}

/**
 * Basic prompt injection prevention for document content.
 *
 * Malicious PDFs could contain text that tries to hijack the LLM's behavior.
 * We filter out common injection patterns before embedding.
 *
 * This is a basic filter — production systems would need more sophisticated
 * detection (e.g., classifier-based).
 *
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeChunkContent(text: string): string {
  // Remove patterns that look like system prompt injection attempts
  const injectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions?/gi,
    /you\s+are\s+now\s+(?:a\s+)?(?:an?\s+)?(?:different|new|other)/gi,
    /disregard\s+(?:all\s+)?(?:previous\s+)?instructions?/gi,
    /act\s+as\s+(?:if\s+)?(?:you\s+are\s+)?(?:a\s+)?(?:an?\s+)?(?:different|new)/gi,
    /system\s*:\s*/gi, // Block "System:" prefix injection
    /\[INST\]|\[\/INST\]/gi, // Block instruction tokens
    /<\|im_start\|>|<\|im_end\|>/gi, // Block special tokens
  ];

  let sanitized = text;
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[filtered]");
  }

  return sanitized;
}

// ── PDF Loading ───────────────────────────────────────────────────────────────

export interface LoadedDocument {
  // Array of LangChain Document objects (one per PDF page)
  pages: Document[];
  // Total page count
  pageCount: number;
  // Raw text from all pages combined
  fullText: string;
}

/**
 * Loads a PDF file and extracts text using LangChain's PDFLoader.
 *
 * PDFLoader uses pdf-parse under the hood.
 * It returns one Document per page, with metadata including page number.
 *
 * @param filePath - Absolute path to the PDF file on disk
 * @returns Promise<LoadedDocument>
 * @throws {Error} If file doesn't exist, isn't a PDF, or is too large
 */
export async function loadPdfDocument(
  filePath: string,
): Promise<LoadedDocument> {
  // ── Validation ─────────────────────────────────────────────

  // Check file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found at path: ${filePath}`);
  }

  // Check file size
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size ${stats.size} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
    );
  }

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".pdf") {
    throw new Error(`Invalid file type: ${ext}. Only PDF files are supported.`);
  }

  console.log(
    `[Loader] Loading PDF: ${path.basename(filePath)} (${(stats.size / 1024).toFixed(1)}KB)`,
  );

  // ── Load with LangChain PDFLoader ──────────────────────────

  try {
    // splitPages: true → returns one Document per page
    // This gives us page-level metadata for citations
    const loader = new PDFLoader(filePath, {
      splitPages: true, // One document per page
      parsedItemSeparator: " ", // Join items with space
    });

    const pages = await loader.load();

    if (pages.length === 0) {
      throw new Error("PDF appears to be empty — no text could be extracted");
    }

    // Clean each page's text
    const cleanedPages = pages.map((page, index) => ({
      ...page,
      pageContent: cleanPdfText(page.pageContent),
      metadata: {
        ...page.metadata,
        // Ensure page number is 1-indexed for human-readable citations
        page: (page.metadata.loc?.pageNumber ?? index) + 1,
        loc: page.metadata.loc,
      },
    }));

    // Filter out pages with no meaningful content
    // (Some PDFs have blank pages or pages with only images)
    const nonEmptyPages = cleanedPages.filter(
      (page) => page.pageContent.trim().length > 20,
    );

    if (nonEmptyPages.length === 0) {
      throw new Error(
        "No readable text found in PDF. " +
          "The document may be scanned/image-based and require OCR.",
      );
    }

    const fullText = nonEmptyPages.map((p) => p.pageContent).join("\n\n");

    console.log(
      `[Loader] Loaded ${nonEmptyPages.length} pages, ` +
        `${fullText.length} total characters`,
    );

    return {
      pages: nonEmptyPages,
      pageCount: pages.length, // Original page count (including empty)
      fullText,
    };
  } catch (error) {
    // If it's our custom error, re-throw as-is
    if (error instanceof Error && error.message.includes("PDF")) {
      throw error;
    }
    console.error("[Loader] PDF loading failed:", error);
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ── Text Splitting ────────────────────────────────────────────────────────────

export interface ChunkResult {
  chunks: Document[];
  chunkCount: number;
  avgChunkSize: number;
}

/**
 * Splits loaded PDF pages into smaller chunks for embedding.
 *
 * Uses RecursiveCharacterTextSplitter which tries to split on:
 *   1. Double newlines (\n\n) — paragraph boundaries
 *   2. Single newlines (\n) — line boundaries
 *   3. Spaces — word boundaries
 *   4. Characters — last resort
 *
 * Why 500 char chunks?
 *   - Small enough to be semantically focused
 *   - Small enough that 4 chunks fit in Groq's 8K context
 *   - Large enough to contain meaningful context
 *
 * @param pages - Array of LangChain Documents from loadPdfDocument
 * @param documentId - Prisma Document.id (added to each chunk's metadata)
 * @returns Promise<ChunkResult>
 */
export async function splitDocumentIntoChunks(
  pages: Document[],
  documentId: string,
): Promise<ChunkResult> {
  console.log(
    `[Splitter] Splitting ${pages.length} pages into chunks ` +
      `(size=${CHUNK_SIZE}, overlap=${CHUNK_OVERLAP})`,
  );

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    // These separators are tried in order
    // We keep paragraph and sentence boundaries as long as possible
    separators: [
      "\n\n", // Paragraph break (best split point)
      "\n", // Line break
      ". ", // Sentence end
      "! ", // Exclamation
      "? ", // Question
      "; ", // Semicolon
      ", ", // Comma
      " ", // Word boundary
      "", // Character level (last resort)
    ],
    // Count by characters (not tokens) — consistent across models
    lengthFunction: (text: string) => text.length,
  });

  try {
    // Split all pages into chunks
    // LangChain preserves metadata from the source Documents
    const rawChunks = await splitter.splitDocuments(pages);

    // Post-process chunks
    const processedChunks: Document[] = rawChunks
      .map((chunk, index) => {
        // Apply injection sanitization
        const sanitizedContent = sanitizeChunkContent(chunk.pageContent);

        return {
          pageContent: sanitizedContent,
          metadata: {
            // Preserve original page metadata
            ...chunk.metadata,
            // Add chunk-level metadata
            documentId, // Links back to Prisma Document
            chunkIndex: index,
            // Note: totalChunks added after we know the full count
          },
        };
      })
      // Remove chunks that are too short to be meaningful
      .filter((chunk) => chunk.pageContent.trim().length >= 50);

    // Now we know total count, add it to each chunk's metadata
    const totalChunks = processedChunks.length;
    const finalChunks = processedChunks.map((chunk) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        totalChunks,
      },
    }));

    // Calculate average chunk size for logging
    const avgSize =
      finalChunks.reduce((sum, c) => sum + c.pageContent.length, 0) /
      finalChunks.length;

    console.log(
      `[Splitter] Created ${totalChunks} chunks, ` +
        `avg size: ${avgSize.toFixed(0)} chars`,
    );

    return {
      chunks: finalChunks,
      chunkCount: totalChunks,
      avgChunkSize: avgSize,
    };
  } catch (error) {
    console.error("[Splitter] Text splitting failed:", error);
    throw new Error(
      `Text splitting failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ── Full Pipeline ─────────────────────────────────────────────────────────────

export interface ProcessedDocument {
  chunks: Document[];
  pageCount: number;
  chunkCount: number;
  avgChunkSize: number;
}

/**
 * Complete document processing pipeline.
 *
 * Combines: Load → Clean → Split → Sanitize
 *
 * This is the main function called by the upload API route.
 *
 * @param filePath - Path to PDF on disk
 * @param documentId - Prisma Document.id
 * @returns Promise<ProcessedDocument>
 */
export async function processPdfDocument(
  filePath: string,
  documentId: string,
): Promise<ProcessedDocument> {
  console.log(`[Pipeline] Starting document processing for ${documentId}`);

  // Step 1: Load PDF
  const { pages, pageCount } = await loadPdfDocument(filePath);

  // Step 2: Split into chunks
  const { chunks, chunkCount, avgChunkSize } = await splitDocumentIntoChunks(
    pages,
    documentId,
  );

  console.log(
    `[Pipeline] Processing complete: ` +
      `${pageCount} pages → ${chunkCount} chunks`,
  );

  return {
    chunks,
    pageCount,
    chunkCount,
    avgChunkSize,
  };
}

// ── File Management Utilities ─────────────────────────────────────────────────

/**
 * Generates a safe storage path for an uploaded file.
 *
 * Format: uploads/{userId}/{timestamp}-{sanitizedFilename}
 * This ensures:
 *   - Files are organized by user (basic FS-level isolation)
 *   - No filename conflicts (timestamp prefix)
 *   - No path traversal attacks (sanitized filename)
 *
 * @param userId - The uploading user's ID
 * @param originalFilename - The original file name from the upload
 * @returns { storagePath, absolutePath }
 */
export function generateStoragePath(
  userId: string,
  originalFilename: string,
): { storagePath: string; absolutePath: string } {
  // Sanitize filename: remove path traversal chars, special chars
  const sanitizedName = originalFilename
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace unsafe chars with underscore
    .replace(/\.{2,}/g, ".") // Prevent path traversal (..)
    .toLowerCase()
    .slice(0, 100); // Limit length

  const timestamp = Date.now();
  const storagePath = `uploads/${userId}/${timestamp}-${sanitizedName}`;

  // Absolute path for local development
  // In production, this would be a cloud storage path (S3, GCS, etc.)
  const absolutePath = path.join(process.cwd(), "public", storagePath);

  return { storagePath, absolutePath };
}

/**
 * Ensures the upload directory exists for a user.
 *
 * @param userId - The user whose directory to create
 */
export function ensureUploadDirectory(userId: string): void {
  const dir = path.join(process.cwd(), "public", "uploads", userId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Deletes a file from disk.
 * Called when document processing fails or document is deleted.
 *
 * @param filePath - Relative storage path (from Document.storagePath)
 */
export function deleteStoredFile(storagePath: string): void {
  const absolutePath = path.join(process.cwd(), "public", storagePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
    console.log(`[FileSystem] Deleted file: ${storagePath}`);
  }
}
