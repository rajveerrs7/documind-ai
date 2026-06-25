<div align="center">

# 🧠 DocuMind AI

**A production-grade multi-tenant GenAI SaaS platform for intelligent document chat**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![LangChain](https://img.shields.io/badge/LangChain-Latest-green)](https://js.langchain.com)
[![Groq](https://img.shields.io/badge/Groq-llama3--8b-orange)](https://groq.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-blue?logo=postgresql)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

[Live Demo](#) · [Documentation](#architecture) · [API Reference](#api-reference)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [RAG Pipeline](#rag-pipeline)
- [Multi-Tenancy](#multi-tenancy)
- [Deployment](#deployment)
- [Evaluation](#evaluation)
- [Contributing](#contributing)

---

## Overview

DocuMind AI is a **production-ready multi-tenant SaaS platform** that enables users to have intelligent conversations with their PDF documents. Built on a modern AI stack with LangChain, Groq, and pgvector, it delivers accurate, citation-backed answers in real-time.

**Key differentiators:**

- 🔒 **Complete data isolation** — every user's data is strictly separated
- 📡 **Streaming responses** — token-by-token delivery via ReadableStream
- 📎 **Grounded answers** — every response includes document citations
- 🆓 **Free tier friendly** — uses free APIs (Groq + HuggingFace)
- 📊 **Usage tracking** — per-user token consumption with limits

---

## Features

### User Features

- 📧 Email + password authentication (JWT, httpOnly cookies)
- 📄 PDF upload with drag-and-drop interface
- 🤖 AI-powered chat with streaming responses
- 📍 Citation tracking (page numbers, relevance scores)
- 💬 Chat history per document
- 📊 Token usage dashboard

### Technical Features

- 🏗️ **RAG Pipeline**: LangChain → HuggingFace → pgvector → Groq
- 🔐 **Multi-tenant isolation**: userId filtering at every layer
- ⚡ **Rate limiting**: Redis sliding window (5 req/min)
- 🛡️ **Prompt injection prevention**: Input sanitization
- 📈 **Admin dashboard**: Platform-wide analytics with Recharts
- 🧪 **Evaluation script**: Precision@K, Groundedness, Relevance

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js 14)                    │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Auth UI │  │  Upload UI   │  │  Chat UI │  │  Admin UI  │  │
│  └──────────┘  └──────────────┘  └──────────┘  └────────────┘  │
│         Zustand State Management + ShadCN Components             │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTP / Streaming (NDJSON)
┌─────────────────────────────────▼───────────────────────────────┐
│                      Next.js API Routes                          │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐  │
│  │ /auth/*  │  │  /upload     │  │  /chat   │  │  /admin/*  │  │
│  └──────────┘  └──────────────┘  └──────────┘  └────────────┘  │
│              Middleware: JWT Auth + Rate Limiting                 │
└────────┬────────────────────────────────────────────────────────┘
         │
    ┌────▼─────────────────────────────────────────────┐
    │              LangChain Orchestration              │
    │  ┌────────────┐  ┌───────────┐  ┌─────────────┐  │
    │  │ PDFLoader  │  │ Splitter  │  │  RAG Chain  │  │
    │  │ (pdf-parse)│  │ (500/100) │  │  (Groq LLM) │  │
    │  └────────────┘  └───────────┘  └─────────────┘  │
    │  ┌─────────────────────────────────────────────┐  │
    │  │   HuggingFace Embeddings (bge-small-en)     │  │
    │  └─────────────────────────────────────────────┘  │
    └────────────────────────┬─────────────────────────┘
                             │
    ┌────────────────────────▼─────────────────────────┐
    │                   Data Layer                      │
    │  ┌──────────────────┐  ┌───────────────────────┐ │
    │  │   PostgreSQL      │  │   pgvector            │ │
    │  │   (Prisma ORM)    │  │   (Embeddings)        │ │
    │  │                   │  │                       │ │
    │  │  users            │  │  document_embeddings  │ │
    │  │  documents        │  │  (384-dim vectors)    │ │
    │  │  chats            │  │                       │ │
    │  │  messages         │  └───────────────────────┘ │
    │  │  usages           │  ┌───────────────────────┐ │
    │  └──────────────────┘  │   Redis (Upstash)     │ │
    │                         │   Rate limiting       │ │
    │                         │   Cache               │ │
    │                         │   JWT blacklist       │ │
    │                         └───────────────────────┘ │
    └──────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer        | Technology                 | Purpose                    |
| ------------ | -------------------------- | -------------------------- |
| Frontend     | Next.js 14 (App Router)    | Full-stack React framework |
| Language     | TypeScript (strict)        | Type safety                |
| Styling      | TailwindCSS + ShadCN UI    | UI components              |
| State        | Zustand                    | Client-side state          |
| ORM          | Prisma                     | Database access            |
| Database     | PostgreSQL (Supabase)      | Relational data            |
| Vectors      | pgvector                   | Embedding storage + search |
| AI Framework | LangChain.js               | RAG orchestration          |
| LLM          | Groq (llama3-8b-8192)      | Chat completion            |
| Embeddings   | HuggingFace (bge-small-en) | Text embeddings            |
| Cache        | Upstash Redis              | Rate limiting + caching    |
| Auth         | JWT (jose) + bcrypt        | Authentication             |
| Charts       | Recharts                   | Admin visualizations       |
| Validation   | Zod                        | Input validation           |
| Deployment   | Vercel + Supabase          | Cloud hosting              |

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended)
- Groq API key (free at console.groq.com)
- HuggingFace API key (free at huggingface.co)
- Upstash Redis (free at console.upstash.com)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/documind-ai.git
cd documind-ai

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# 4. Set up database
# Run prisma/setup-pgvector.sql in your Supabase SQL editor first
npx prisma generate
npx prisma db push

# 5. Start development server
npm run dev
```

Visit `http://localhost:3000` — register an account and start uploading!

### First-time Setup

1. **Register** — Create an account at `/register`
   - The email matching `ADMIN_EMAIL` in `.env` gets ADMIN role
2. **Upload** — Go to Documents → drag a PDF
3. **Chat** — Click "Chat" on a ready document → ask questions
4. **Admin** — Visit `/dashboard/admin` (admin accounts only)

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."      # Supabase connection URL
DIRECT_URL="postgresql://..."        # Direct connection (migrations)

# AI Services
GROQ_API_KEY="gsk_..."              # groq.com - free tier
HUGGINGFACEHUB_API_KEY="hf_..."     # huggingface.co - free tier

# Auth
JWT_SECRET="min-32-chars-secret"    # openssl rand -base64 64

# Redis
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# App Config
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_EMAIL="admin@yourdomain.com"
FREE_TIER_MONTHLY_TOKEN_LIMIT=50000
MAX_FILE_SIZE_BYTES=10485760
VECTOR_STORE_TABLE_NAME="document_embeddings"
RETRIEVER_TOP_K=4
```

See `.env.example` for the complete list.

---

## Project Structure

```
documind-ai/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login page
│   │   └── register/page.tsx       # Registration page
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx      # Home dashboard
│   │   ├── documents/page.tsx      # Document management
│   │   ├── chat/page.tsx           # Chat interface
│   │   ├── admin/page.tsx          # Admin dashboard
│   │   └── layout.tsx              # Dashboard layout + sidebar
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register/route.ts
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── upload/route.ts         # PDF upload + processing
│   │   ├── chat/
│   │   │   ├── route.ts            # Streaming chat
│   │   │   ├── history/route.ts
│   │   │   └── [chatId]/messages/route.ts
│   │   ├── documents/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── status/route.ts
│   │   ├── admin/
│   │   │   ├── stats/route.ts
│   │   │   └── users/route.ts
│   │   └── health/route.ts
│   ├── globals.css
│   └── layout.tsx
│
├── components/
│   ├── auth/
│   │   └── auth-initializer.tsx
│   ├── chat/
│   │   ├── chat-input.tsx
│   │   ├── chat-message.tsx
│   │   ├── chat-sidebar.tsx
│   │   ├── chat-window.tsx
│   │   └── citation-card.tsx
│   ├── documents/
│   │   ├── document-card.tsx
│   │   └── upload-dropzone.tsx
│   └── admin/
│       ├── stats-cards.tsx
│       ├── usage-charts.tsx
│       ├── recent-documents-table.tsx
│       └── top-users-table.tsx
│
├── lib/
│   ├── langchain/
│   │   ├── embeddings.ts           # HuggingFace bge-small-en
│   │   ├── vector-store.ts         # pgvector CRUD
│   │   ├── loaders.ts              # PDF → chunks pipeline
│   │   ├── chains.ts               # RAG + Groq streaming
│   │   └── index.ts                # Public API
│   ├── stores/
│   │   ├── auth-store.ts           # Zustand auth state
│   │   ├── chat-store.ts           # Zustand chat + streaming
│   │   └── document-store.ts       # Zustand documents
│   ├── prisma/
│   │   └── client.ts               # Prisma singleton
│   ├── auth/
│   │   └── index.ts                # JWT + bcrypt utilities
│   ├── validators/
│   │   └── index.ts                # Zod schemas
│   └── redis.ts                    # Upstash Redis client
│
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── setup-pgvector.sql          # pgvector + table setup
│
├── scripts/
│   └── evaluate.ts                 # RAG evaluation script
│
├── types/
│   └── index.ts                    # Shared TypeScript types
│
├── middleware.ts                    # Route protection (Edge)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
└── .env.example
```

---

## API Reference

### Authentication

| Method | Endpoint             | Description        | Auth Required |
| ------ | -------------------- | ------------------ | ------------- |
| POST   | `/api/auth/register` | Create new account | No            |
| POST   | `/api/auth/login`    | Sign in            | No            |
| POST   | `/api/auth/logout`   | Sign out           | Yes           |
| GET    | `/api/auth/me`       | Get current user   | Yes           |

### Documents

| Method | Endpoint                     | Description       | Auth Required |
| ------ | ---------------------------- | ----------------- | ------------- |
| POST   | `/api/upload`                | Upload PDF        | Yes           |
| GET    | `/api/documents`             | List documents    | Yes           |
| GET    | `/api/documents/[id]`        | Get document      | Yes           |
| DELETE | `/api/documents/[id]`        | Delete document   | Yes           |
| GET    | `/api/documents/[id]/status` | Processing status | Yes           |

### Chat

| Method | Endpoint                  | Description              | Auth Required |
| ------ | ------------------------- | ------------------------ | ------------- |
| POST   | `/api/chat`               | Send message (streaming) | Yes           |
| GET    | `/api/chat/history`       | List chats               | Yes           |
| GET    | `/api/chat/[id]/messages` | Get messages             | Yes           |

### Admin

| Method | Endpoint           | Description         | Auth Required |
| ------ | ------------------ | ------------------- | ------------- |
| GET    | `/api/admin/stats` | Platform statistics | Admin         |
| GET    | `/api/admin/users` | User list           | Admin         |

### Streaming Response Format

The `/api/chat` endpoint streams NDJSON (newline-delimited JSON):

```jsonc
// Token chunk (one per streamed word/token)
{"type":"token","content":"Based"}

// Citations (sent after all tokens)
{"type":"citations","citations":[
  {"page":1,"text":"excerpt...","score":0.87,"filename":"doc.pdf","chunkIndex":0}
]}

// Completion signal
{"type":"done","messageId":"msg_xxx","usage":{"inputTokens":450,"outputTokens":120}}

// Error (if something goes wrong)
{"type":"error","error":"Rate limit exceeded"}
```

---

## RAG Pipeline

### Document Ingestion

```
PDF File
    │
    ▼
LangChain PDFLoader
(pdf-parse, split by page)
    │
    ▼
Text Cleaning
(fix hyphenation, normalize whitespace)
    │
    ▼
RecursiveCharacterTextSplitter
(chunk_size=500, overlap=100)
    │
    ▼
Prompt Injection Sanitization
    │
    ▼
HuggingFace Embeddings
(BAAI/bge-small-en-v1.5, 384-dim)
    │
    ▼
pgvector Storage
(with userId + documentId metadata)
    │
    ▼
Prisma Document.status = READY
```

### Query Processing

```
User Question
    │
    ▼
Input Validation + Sanitization
    │
    ▼
HuggingFace Query Embedding
    │
    ▼
pgvector Similarity Search
(filter: userId + documentId, top-K=4)
    │
    ▼
Context Assembly
[Source 1 - Page N]
chunk content...
---
[Source 2 - Page N]
chunk content...
    │
    ▼
ChatGroq (llama3-8b-8192)
System: Only answer from context
User: {question}
    │
    ▼
Streaming Tokens → NDJSON → Client
    │
    ▼
Citations + Usage saved to Prisma
```

### Chunking Strategy

| Parameter     | Value       | Reason                                     |
| ------------- | ----------- | ------------------------------------------ |
| Chunk size    | 500 chars   | ~125 tokens, 4 chunks ≈ 500 tokens context |
| Overlap       | 100 chars   | Prevents context loss at boundaries        |
| Top-K         | 4 chunks    | Leaves ~7500 tokens for system + response  |
| Model context | 8192 tokens | Groq llama3-8b-8192 limit                  |

---

## Multi-Tenancy

DocuMind AI enforces strict data isolation through multiple layers:

### Application Layer (Primary)

Every database query includes `userId` as a filter:

```typescript
// ✅ Always done — userId filter on every query
await prisma.document.findMany({
  where: { userId }, // ← tenant isolation
});
```

### Vector Store Layer

Every embedding includes `userId` in metadata,
and every search filters by `userId`:

```typescript
// Storage: userId embedded in every chunk
metadata: { userId, documentId, ... }

// Retrieval: filter applied to every search
filter: { userId, documentId }
```

### Middleware Layer

JWT tokens are verified on every request.
User ID extracted from token and injected into headers.
Route handlers use these headers — never trust client-supplied user IDs.

### What This Prevents

- ✅ User A cannot see User B's documents
- ✅ User A cannot search User B's embeddings
- ✅ User A cannot access User B's chats
- ✅ Cross-tenant data leakage impossible at DB level

---

## Deployment

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/documind-ai)

### Manual Deployment

1. **Supabase**: See `docs/supabase-setup.md`
2. **Vercel**: See `docs/vercel-deployment.md`
3. **Upstash**: Create free Redis at console.upstash.com

### Environment Requirements

| Service       | Free Tier Limits                     |
| ------------- | ------------------------------------ |
| Supabase      | 500MB DB, 1GB bandwidth/month        |
| Vercel        | 100GB bandwidth, 100hr compute/month |
| Groq          | 14,400 req/day, 30 req/min           |
| HuggingFace   | Rate limited, ~1 req/sec             |
| Upstash Redis | 10,000 commands/day, 256MB           |

---

## Evaluation

Run the RAG evaluation script to measure pipeline quality:

```bash
# Set your test document details
export EVAL_USER_ID="your-prisma-user-id"
export EVAL_DOCUMENT_ID="your-prisma-document-id"

# Run evaluation
npm run evaluate
```

### Metrics

| Metric               | Description                                              | Target |
| -------------------- | -------------------------------------------------------- | ------ |
| **Precision@4**      | Fraction of retrieved chunks containing relevant content | ≥ 0.50 |
| **Groundedness**     | Fraction of answers grounded in retrieved context        | ≥ 0.80 |
| **Answer Relevance** | Fraction of answers addressing the question              | ≥ 0.75 |

### Sample Output

```
═══════════════════════════════════════════════════════════════════
  DocuMind AI — RAG Evaluation Report
═══════════════════════════════════════════════════════════════════
  Precision@4          : 65.0%
  Groundedness Rate    : 80.0%
  Answer Relevance     : 80.0%
───────────────────────────────────────────────────────────────────
  Avg Retrieval Time   : 342ms
  Avg Generation Time  : 1820ms
  Avg Total Time       : 2162ms
───────────────────────────────────────────────────────────────────
  Avg Input Tokens     : 892
  Avg Output Tokens    : 187
═══════════════════════════════════════════════════════════════════
```

---

## Security Considerations

- 🔒 **Passwords**: bcrypt with 12 rounds
- 🎫 **JWT**: httpOnly cookies, 7-day expiry, Redis blacklist on logout
- 🛡️ **CSRF**: SameSite=Lax cookie attribute
- 💉 **Injection**: Input sanitization for both user queries and PDF content
- 🚦 **Rate limiting**: 5 chat requests/minute, 10 login attempts/minute
- 📏 **File validation**: Type + size + content checks
- 🔐 **Tenant isolation**: userId required on all data access
- 🏠 **Path traversal**: Filename sanitization on upload

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- All new API routes must include authentication checks
- All database queries must include `userId` for tenant isolation
- All user inputs must be validated with Zod
- New LangChain operations must include error handling
- Test with the evaluation script before submitting PRs

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ❤️ using Next.js, LangChain, Groq, and pgvector

**[⬆ Back to Top](#)**

</div>
