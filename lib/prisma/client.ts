// ─────────────────────────────────────────────────────────────────────────────
// Prisma Client Singleton
//
// In Next.js development mode, hot-reloading causes new Prisma Client
// instances to be created on every reload, exhausting database connections.
//
// This singleton pattern prevents that by storing the client on the
// global object (which persists across hot-reloads in development).
// In production, a single module-level instance is used.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

// Extend the global type to include our prisma instance
// This prevents TypeScript errors when accessing global.prisma
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Create the Prisma client with logging configuration
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"] // Verbose logging in dev
        : ["error"], // Only errors in production
    errorFormat: "pretty",
  });
}

// Singleton: reuse existing client or create new one
const prisma = globalThis.__prisma ?? createPrismaClient();

// In development, store on global to survive hot-reloads
if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export { prisma };
export default prisma;
