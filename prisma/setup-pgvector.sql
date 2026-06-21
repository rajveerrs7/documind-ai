-- ─────────────────────────────────────────────────────────────────────────────
-- DocuMind AI — PostgreSQL + pgvector Setup Script
--
-- Run this script on your Supabase PostgreSQL instance BEFORE
-- running prisma migrate deploy.
--
-- On Supabase, pgvector is already available. Just enable the extension.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Enable pgvector extension
-- This adds vector data type and similarity search operators
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Enable uuid-ossp for UUID generation (optional, cuid used by Prisma)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Create the LangChain PGVector table
--
-- LangChain's PostgresVectorStore can auto-create this table, but we
-- define it explicitly here for:
--   a) Better control over indexes
--   b) Explicit metadata schema documentation
--   c) Ensuring it exists before any app code runs
--
-- Embedding dimension: 384 (BAAI/bge-small-en-v1.5 output size)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_embeddings (
  -- Primary key (LangChain uses uuid)
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- The embedding vector (384 dimensions for bge-small-en-v1.5)
  embedding vector(384),

  -- The text chunk content that was embedded
  document TEXT,

  -- Metadata stored as JSONB for flexible querying
  -- Expected fields:
  --   userId     : String  (Prisma User.id — for multi-tenant isolation)
  --   documentId : String  (Prisma Document.id — for document-level filtering)
  --   filename   : String  (Original PDF filename)
  --   page       : Number  (Page number in the PDF, 0-indexed)
  --   chunkIndex : Number  (Position of chunk within document)
  --   totalChunks: Number  (Total chunks in document)
  cmetadata JSONB DEFAULT '{}'::JSONB,

  -- Custom field we add for efficient filtering (denormalized from metadata)
  -- This avoids JSONB extraction overhead on every query
  -- Note: LangChain may call this differently; we handle it in our wrapper
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Create Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- IVFFlat index for approximate nearest neighbor (ANN) vector search
-- lists = 100 is a good starting point for datasets up to ~1M vectors
-- For cosine similarity (matches HuggingFace bge model's training objective)
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx
  ON document_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- JSONB index for fast metadata filtering
-- Critical for multi-tenant isolation: WHERE cmetadata->>'userId' = $1
CREATE INDEX IF NOT EXISTS document_embeddings_metadata_idx
  ON document_embeddings
  USING GIN (cmetadata);

-- Index specifically on userId for fast tenant filtering
-- (extracted from JSONB for performance)
CREATE INDEX IF NOT EXISTS document_embeddings_user_idx
  ON document_embeddings ((cmetadata->>'userId'));

-- Index on documentId for document-specific queries
CREATE INDEX IF NOT EXISTS document_embeddings_document_idx
  ON document_embeddings ((cmetadata->>'documentId'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: Row Level Security (RLS) — Optional but recommended for Supabase
-- Uncomment if you want database-level isolation in addition to app-level
-- ─────────────────────────────────────────────────────────────────────────────

-- ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run after setup to confirm)
-- ─────────────────────────────────────────────────────────────────────────────

-- Check extensions
-- SELECT * FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp');

-- Check table exists
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name = 'document_embeddings';

-- Check indexes
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'document_embeddings';