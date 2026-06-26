// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upload
//
// Handles PDF file uploads and triggers the full RAG ingestion pipeline.
//
// Flow:
//   1. Authenticate user (JWT from middleware headers)
//   2. Parse multipart form data
//   3. Validate file (size, type, content)
//   4. Save file to temporary disk storage
//   5. Create Document record in Prisma (status: PENDING)
//   6. Trigger async processing pipeline:
//      a. Load PDF (LangChain PDFLoader)
//      b. Split into chunks (RecursiveCharacterTextSplitter)
//      c. Generate embeddings (HuggingFace)
//      d. Store in pgvector (LangChain PGVectorStore)
//   7. Update Document record (status: READY, chunkCount, pageCount)
//   8. Return document metadata
//
// Note on async processing:
//   In production, step 6 would be offloaded to a background job queue
//   (e.g., BullMQ, Inngest, Vercel background functions).
//   For this implementation, we process synchronously but stream
//   status updates via the /api/documents/[id]/status endpoint.
//
// File size limit: 10MB (enforced by Next.js config + our validation)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma/client";
import { DocumentStatus } from "@prisma/client";
import {
  processPdfDocument,
  storeDocumentChunks,
} from "@/lib/langchain";
import { setDocumentProcessingStatus } from "@/lib/redis";
import { checkRateLimit } from "@/lib/redis";
import type { ApiResponse, UploadResponse } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_BYTES || "10485760");
const ALLOWED_MIME_TYPES = ["application/pdf"];
const ALLOWED_EXTENSIONS = [".pdf"];

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Extract authenticated user (injected by middleware) ────
  const userId = request.headers.get("x-user-id");
  const userEmail = request.headers.get("x-user-email");

  if (!userId || !userEmail) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  // ── Rate limiting: 5 uploads per minute per user ───────────
  const rateLimit = await checkRateLimit(userId, "upload", 5, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: `Upload rate limit exceeded. Try again in ${rateLimit.resetAt - Math.floor(Date.now() / 1000)} seconds.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            rateLimit.resetAt - Math.floor(Date.now() / 1000),
          ),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      },
    );
  }

  // ── Check document count limit (max 20 docs per user) ─────
  const docCount = await prisma.document.count({
    where: { userId },
  });

  if (docCount >= 20) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error:
          "Document limit reached (20 documents maximum). Please delete some documents to upload more.",
      },
      { status: 403 },
    );
  }

  // ── Parse multipart form data ──────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to parse form data" },
      { status: 400 },
    );
  }

  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "No file provided. Include a file with key 'file'",
      },
      { status: 400 },
    );
  }

  // ── Validate file type ────────────────────────────────────
  const fileExtension = path.extname(file.name).toLowerCase();
  const mimeType = file.type;

  if (
    !ALLOWED_MIME_TYPES.includes(mimeType) ||
    !ALLOWED_EXTENSIONS.includes(fileExtension)
  ) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: `Invalid file type. Only PDF files are accepted. Received: ${mimeType}`,
      },
      { status: 400 },
    );
  }

  // ── Validate file size ────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB`,
      },
      { status: 413 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "File is empty" },
      { status: 400 },
    );
  }

  // ── Sanitize filename ─────────────────────────────────────
  // Remove path traversal attempts and special characters
  const sanitizedFilename = file.name
    .replace(/[^a-zA-Z0-9._\-\s]/g, "_")
    .replace(/\.{2,}/g, ".")
    .trim()
    .slice(0, 255);

  // ── Generate storage path ─────────────────────────────────
  const tempDir = path.join(tmpdir(), "documind-ai");
  const tempFilename = `${Date.now()}-${randomUUID()}-${sanitizedFilename}`;
  const tempPath = path.join(tempDir, tempFilename);
  const storagePath = path.join("temp", userId, tempFilename);

  // ── Create Document record (PENDING) ─────────────────────
  // We create the DB record BEFORE saving the file so we have
  // an ID to use for the storage path and vector metadata
  let document = await prisma.document.create({
    data: {
      userId,
      filename: sanitizedFilename,
      storagePath,
      fileSize: file.size,
      mimeType,
      status: DocumentStatus.PENDING,
    },
  });

  // Update cache with initial status
  await setDocumentProcessingStatus(document.id, DocumentStatus.PENDING);

  // ── Save file to temporary storage ────────────────────────
  try {
    // Ensure upload directory exists
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Convert File to Buffer and write to temp storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempPath, fileBuffer);

    console.log(
      `[Upload] Temp file created for ingestion: ${tempFilename} (${(file.size / 1024).toFixed(1)}KB)`,
    );
  } catch (error) {
    // Clean up DB record if file save fails
    await prisma.document.delete({ where: { id: document.id } });

    console.error("[Upload] File save failed:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to save file. Please try again." },
      { status: 500 },
    );
  }

  // ── Update status to PROCESSING ───────────────────────────
  document = await prisma.document.update({
    where: { id: document.id },
    data: { status: DocumentStatus.PROCESSING },
  });
  await setDocumentProcessingStatus(document.id, DocumentStatus.PROCESSING);

  // ── Run RAG Ingestion Pipeline ────────────────────────────
  try {
    console.log(`[Upload] Starting RAG pipeline for document ${document.id}`);

    // Step 1 & 2: Load PDF and split into chunks
    const { chunks, pageCount, chunkCount } = await processPdfDocument(
      tempPath,
      document.id,
    );

    console.log(
      `[Upload] Processed ${pageCount} pages into ${chunkCount} chunks`,
    );

    // Step 3 & 4: Generate embeddings and store in pgvector
    await storeDocumentChunks(chunks, userId, document.id, sanitizedFilename);

    console.log(`[Upload] Embeddings stored for document ${document.id}`);

    // ── Update Document to READY ──────────────────────────
    document = await prisma.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.READY,
        pageCount,
        chunkCount,
      },
    });

    await setDocumentProcessingStatus(document.id, DocumentStatus.READY);

    console.log(
      `[Upload] Document ${document.id} is READY (${pageCount} pages, ${chunkCount} chunks)`,
    );

    return NextResponse.json<ApiResponse<UploadResponse>>(
      {
        success: true,
        data: {
          documentId: document.id,
          filename: document.filename,
          status: document.status,
          pageCount: document.pageCount || 0,
          chunkCount: document.chunkCount || 0,
        },
        message: `Document processed successfully: ${pageCount} pages, ${chunkCount} chunks indexed`,
      },
      { status: 201 },
    );
  } catch (error) {
    // ── Mark document as FAILED ───────────────────────────
    const errorMessage =
      error instanceof Error ? error.message : "Processing failed";

    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.FAILED,
        errorMessage,
      },
    });

    await setDocumentProcessingStatus(document.id, DocumentStatus.FAILED);

    console.error(
      `[Upload] Pipeline failed for document ${document.id}:`,
      error,
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: `Document processing failed: ${errorMessage}`,
        data: {
          documentId: document.id,
          status: DocumentStatus.FAILED,
        },
      },
      { status: 422 },
    );
  } finally {
    try {
      await rm(tempPath, { force: true });
    } catch (cleanupError) {
      console.warn("[Upload] Temp file cleanup failed:", cleanupError);
    }
  }
}
