// ─────────────────────────────────────────────────────────────────────────────
// LangChain Module — Public API
//
// Re-exports the public interface of the LangChain layer.
// Other parts of the app import from here, not from individual files.
// This makes it easy to swap implementations without changing call sites.
// ─────────────────────────────────────────────────────────────────────────────

// Embeddings
export {
  getEmbeddings,
  embedQuery,
  embedDocuments,
  validateEmbeddingsService,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
} from "./embeddings";

// Vector Store
export {
  storeDocumentChunks,
  searchSimilarChunks,
  createRetriever,
  deleteDocumentEmbeddings,
  getTotalEmbeddingCount,
  getUserEmbeddingCount,
} from "./vector-store";

// Document Loaders & Splitters
export {
  loadPdfDocument,
  splitDocumentIntoChunks,
  processPdfDocument,
  generateStoragePath,
  ensureUploadDirectory,
  deleteStoredFile,
  cleanPdfText,
  sanitizeChunkContent,
  CHUNK_SIZE,
  CHUNK_OVERLAP,
} from "./loaders";

// RAG Chains
export {
  runRagPipeline,
  runRagPipelineSync,
  createGroqLLM,
  buildCitations,
  sanitizeUserInput,
  GROQ_MODEL,
  LLM_TEMPERATURE,
} from "./chains";

// Types
export type { TokenUsage, RagResult, RagStreamResult } from "./chains";
export type { RetrievedChunk } from "./vector-store";
export type { LoadedDocument, ChunkResult, ProcessedDocument } from "./loaders";
