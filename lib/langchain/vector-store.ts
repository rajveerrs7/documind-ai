// ─────────────────────────────────────────────────────────────────────────────
// LangChain PGVector Store Configuration
//
// Uses LangChain's PostgresVectorStore from @langchain/community.
// This manages the "document_embeddings" table in PostgreSQL.
//
// CRITICAL MULTI-TENANT DESIGN:
//   Every read operation MUST filter by userId.
//   Every write operation MUST include userId in metadata.
//   This is the primary mechanism for data isolation.
//
// Architecture:
//   - Prisma manages: Users, Documents, Chats, Messages, Usage
//   - PGVector manages: Embeddings + semantic search
//   - Link: cmetadata->>'documentId' = Prisma Document.id
//           cmetadata->>'userId'     = Prisma User.id
// ─────────────────────────────────────────────────────────────────────────────

import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { PoolConfig } from "pg";
import { getEmbeddings } from "./embeddings";
import type { VectorMetadata } from "@/types";
import type { Document } from "@langchain/core/documents";

// ── Configuration ─────────────────────────────────────────────────────────────

// Table name for vector storage (matches our SQL setup script)
const VECTOR_TABLE_NAME =
  process.env.VECTOR_STORE_TABLE_NAME || "document_embeddings";

// PostgreSQL connection config extracted from DATABASE_URL
// PGVectorStore needs a pool config, not a connection string
function getPgPoolConfig(): PoolConfig {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Parse the connection URL into pg PoolConfig
  // Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?params
  const url = new URL(dbUrl);

  return {
    host: url.hostname,
    port: parseInt(url.port || "5432"),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // Remove leading "/"
    // SSL required for Supabase
    ssl:
      url.searchParams.get("sslmode") === "require"
        ? { rejectUnauthorized: false }
        : false,
    // Connection pool settings
    max: 10, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

// ── PGVectorStore Config Object ───────────────────────────────────────────────

function getVectorStoreConfig() {
  return {
    postgresConnectionOptions: getPgPoolConfig(),
    tableName: VECTOR_TABLE_NAME,
    columns: {
      // Column names in our document_embeddings table
      idColumnName: "id",
      vectorColumnName: "embedding",
      contentColumnName: "document",
      metadataColumnName: "cmetadata",
    },
    // Cosine distance for similarity search
    // Matches bge model's training objective
    distanceStrategy: "cosine" as const,
  };
}

// ── Core Vector Store Functions ───────────────────────────────────────────────

/**
 * Creates a new PGVectorStore instance.
 *
 * We create fresh instances rather than singletons because:
 * 1. Each instance holds a pg Pool — we don't want connection leaks
 * 2. Next.js serverless functions are short-lived
 * 3. PGVectorStore handles pool internally
 *
 * @returns Promise<PGVectorStore>
 */
async function createVectorStore(): Promise<PGVectorStore> {
  const embeddings = getEmbeddings();
  const config = getVectorStoreConfig();

  const store = await PGVectorStore.initialize(embeddings, config);

  return store;
}

// ── Document Storage ──────────────────────────────────────────────────────────

/**
 * Stores document chunks and their embeddings in the vector store.
 *
 * This is called after PDF parsing and text splitting.
 * Each chunk gets:
 *   - Its text embedded via HuggingFace
 *   - Metadata attached (userId, documentId, page, etc.)
 *   - Stored in the document_embeddings table
 *
 * TENANT ISOLATION: userId is stored in every chunk's metadata.
 *
 * @param chunks - Array of LangChain Document objects (text + metadata)
 * @param userId - The user who owns this document (for isolation)
 * @param documentId - The Prisma Document.id
 * @param filename - Original PDF filename
 * @returns Promise<void>
 */
export async function storeDocumentChunks(
  chunks: Document[],
  userId: string,
  documentId: string,
  filename: string,
): Promise<void> {
  if (chunks.length === 0) {
    throw new Error("No chunks to store");
  }

  console.log(
    `[VectorStore] Storing ${chunks.length} chunks for document ${documentId}`,
  );

  // Enrich each chunk with our required metadata
  // This metadata is stored in the cmetadata JSONB column
  const enrichedChunks: Document[] = chunks.map((chunk, index) => ({
    pageContent: chunk.pageContent,
    metadata: {
      // ── Tenant isolation fields (CRITICAL) ──
      userId, // Filter all queries by this
      documentId, // Link back to Prisma Document

      // ── Source attribution for citations ──
      filename,
      // pdf-parse provides loc.pageNumber (1-indexed)
      page: chunk.metadata?.loc?.pageNumber ?? chunk.metadata?.page ?? index,
      chunkIndex: index,
      totalChunks: chunks.length,

      // ── Original LangChain metadata (preserve) ──
      ...chunk.metadata,
    } satisfies VectorMetadata & Record<string, unknown>,
  }));

  const store = await createVectorStore();

  try {
    // LangChain handles batching + embedding internally
    await store.addDocuments(enrichedChunks);
    console.log(
      `[VectorStore] Successfully stored ${enrichedChunks.length} chunks`,
    );
  } catch (error) {
    console.error("[VectorStore] Failed to store chunks:", error);
    throw new Error(
      `Vector storage failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  } finally {
    // Clean up the pool connection
    await store.end();
  }
}

// ── Similarity Search (Retrieval) ─────────────────────────────────────────────

export interface RetrievedChunk {
  content: string;
  metadata: VectorMetadata & Record<string, unknown>;
  score: number;
}

/**
 * Searches for semantically similar chunks to the user's query.
 *
 * CRITICAL MULTI-TENANT ISOLATION:
 * We filter by BOTH userId AND documentId to ensure:
 *   1. Users can only see their own documents (userId filter)
 *   2. We only search the relevant document (documentId filter)
 *
 * We retrieve top-K=4 chunks to stay within Groq's 8K context window
 * while still providing meaningful context.
 *
 * @param query - The user's question
 * @param userId - Must match the chunk's metadata.userId
 * @param documentId - Must match the chunk's metadata.documentId
 * @param topK - Number of chunks to retrieve (default: 4)
 * @returns Promise<RetrievedChunk[]>
 */
export async function searchSimilarChunks(
  query: string,
  userId: string,
  documentId: string,
  topK: number = parseInt(process.env.RETRIEVER_TOP_K || "4"),
): Promise<RetrievedChunk[]> {
  if (!query.trim()) {
    throw new Error("Query cannot be empty");
  }

  console.log(
    `[VectorStore] Searching for: "${query.slice(0, 50)}..." (userId=${userId}, docId=${documentId})`,
  );

  const store = await createVectorStore();

  try {
    // PGVectorStore's similaritySearchWithScore returns [Document, score][]
    // The filter object maps to WHERE cmetadata @> '{"key": "value"}'::jsonb
    const results = await store.similaritySearchWithScore(
      query,
      topK,
      // Filter: BOTH userId AND documentId must match
      // This is our multi-tenant isolation guarantee
      {
        userId: userId,
        documentId: documentId,
      },
    );

    // Transform to our internal type
    const chunks: RetrievedChunk[] = results.map(([doc, score]) => ({
      content: doc.pageContent,
      metadata: doc.metadata as VectorMetadata & Record<string, unknown>,
      // PGVectorStore returns cosine distance (0=identical, 2=opposite)
      // Convert to similarity score (1=identical, 0=no similarity)
      // For cosine: similarity = 1 - (distance / 2)  [normalized to 0-1]
      score: Math.max(0, 1 - score),
    }));

    console.log(
      `[VectorStore] Retrieved ${chunks.length} chunks, ` +
        `top score: ${chunks[0]?.score?.toFixed(3) ?? "N/A"}`,
    );

    return chunks;
  } catch (error) {
    console.error("[VectorStore] Search failed:", error);
    throw new Error(
      `Vector search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  } finally {
    await store.end();
  }
}

/**
 * Creates a LangChain Retriever for use in RAG chains.
 *
 * This is used by the LangChain createRetrievalChain function.
 * It wraps our searchSimilarChunks with LangChain's Retriever interface.
 *
 * @param userId - For multi-tenant filtering
 * @param documentId - For document-specific retrieval
 * @param topK - Chunks to retrieve
 */
export async function createRetriever(
  userId: string,
  documentId: string,
  topK: number = parseInt(process.env.RETRIEVER_TOP_K || "4"),
) {
  const store = await createVectorStore();

  // PGVectorStore.asRetriever creates a VectorStoreRetriever
  // We pass the filter to ensure tenant isolation
  const retriever = store.asRetriever({
    k: topK,
    // Filter applied to every retrieval call
    filter: {
      userId: userId,
      documentId: documentId,
    },
    // Include scores for citation quality indicators
    searchType: "similarity",
  });

  return { retriever, store };
}

// ── Deletion ──────────────────────────────────────────────────────────────────

/**
 * Deletes all embeddings for a specific document.
 *
 * Called when a user deletes a document from the UI.
 * We delete by matching documentId in the metadata.
 *
 * TENANT SAFETY: We also check userId to prevent cross-tenant deletion.
 *
 * @param documentId - Prisma Document.id
 * @param userId - Owner of the document
 */
export async function deleteDocumentEmbeddings(
  documentId: string,
  userId: string,
): Promise<void> {
  console.log(
    `[VectorStore] Deleting embeddings for document ${documentId} (userId=${userId})`,
  );

  // We need to query IDs first, then delete by ID
  // PGVectorStore doesn't support delete-by-filter directly in all versions
  const store = await createVectorStore();

  try {
    // Use raw SQL via the store's client for efficient bulk deletion
    // This is safe because we parameterize the values
    // Access the underlying pool through the store's client property
    const client = (
      store as unknown as {
        client: {
          query: (
            sql: string,
            params: unknown[],
          ) => Promise<{ rows: { id: string }[] }>;
        };
      }
    ).client;

    const result = await client.query(
      `DELETE FROM ${VECTOR_TABLE_NAME}
       WHERE cmetadata->>'documentId' = $1
       AND cmetadata->>'userId' = $2
       RETURNING id`,
      [documentId, userId],
    );

    console.log(
      `[VectorStore] Deleted ${result.rows.length} embeddings for document ${documentId}`,
    );
  } catch (error) {
    console.error("[VectorStore] Deletion failed:", error);
    throw new Error(
      `Failed to delete embeddings: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  } finally {
    await store.end();
  }
}

// ── Admin Stats ───────────────────────────────────────────────────────────────

/**
 * Gets the total count of embeddings in the vector store.
 * Used by the admin dashboard.
 *
 * @returns Promise<number>
 */
export async function getTotalEmbeddingCount(): Promise<number> {
  const store = await createVectorStore();

  try {
    const client = (
      store as unknown as {
        client: {
          query: (sql: string) => Promise<{ rows: { count: string }[] }>;
        };
      }
    ).client;

    const result = await client.query(
      `SELECT COUNT(*) as count FROM ${VECTOR_TABLE_NAME}`,
    );

    return parseInt(result.rows[0]?.count || "0", 10);
  } catch (error) {
    console.error("[VectorStore] Count query failed:", error);
    return 0;
  } finally {
    await store.end();
  }
}

/**
 * Gets embedding count for a specific user.
 *
 * @param userId - The user to count for
 * @returns Promise<number>
 */
export async function getUserEmbeddingCount(userId: string): Promise<number> {
  const store = await createVectorStore();

  try {
    const client = (
      store as unknown as {
        client: {
          query: (
            sql: string,
            params: unknown[],
          ) => Promise<{ rows: { count: string }[] }>;
        };
      }
    ).client;

    const result = await client.query(
      `SELECT COUNT(*) as count FROM ${VECTOR_TABLE_NAME}
       WHERE cmetadata->>'userId' = $1`,
      [userId],
    );

    return parseInt(result.rows[0]?.count || "0", 10);
  } catch (error) {
    console.error("[VectorStore] User count query failed:", error);
    return 0;
  } finally {
    await store.end();
  }
}
