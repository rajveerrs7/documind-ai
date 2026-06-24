// ─────────────────────────────────────────────────────────────────────────────
// Input Validators using Zod
//
// All API inputs are validated here before processing.
// Zod provides runtime type checking + nice error messages.
//
// We define validators for:
//   - Registration
//   - Login
//   - Chat messages
//   - Document uploads
//   - Admin actions
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Auth Validators ───────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .max(254, "Email too long") // RFC 5321 limit
    .toLowerCase()
    .trim(),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),

  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .trim()
    .optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .toLowerCase()
    .trim(),

  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password too long"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ── Chat Validators ───────────────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
  // Optional — if provided, adds to existing chat; if omitted, creates new
  chatId: z.string().cuid("Invalid chat ID").optional(),

  documentId: z
    .string()
    .cuid("Invalid document ID")
    .min(1, "Document ID is required"),

  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message too long (max 2000 characters)")
    .trim(),
});

export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;

// ── Document Validators ───────────────────────────────────────────────────────

export const DocumentQuerySchema = z.object({
  documentId: z.string().cuid("Invalid document ID"),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// ── Chat History Validators ───────────────────────────────────────────────────

export const ChatHistorySchema = z.object({
  chatId: z.string().cuid("Invalid chat ID"),
});

// ── Admin Validators ──────────────────────────────────────────────────────────

export const AdminUserQuerySchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
});

// ── Utility: Parse and format Zod errors ─────────────────────────────────────

/**
 * Formats Zod validation errors into a human-readable string.
 *
 * @param error - ZodError from schema.safeParse()
 * @returns Formatted error message
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((e) => {
      const field = e.path.join(".");
      return field ? `${field}: ${e.message}` : e.message;
    })
    .join("; ");
}

/**
 * Validates input against a schema and returns typed result.
 * Throws a descriptive error if validation fails.
 *
 * @param schema - Zod schema
 * @param data - Raw input data
 * @returns Validated and typed data
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }
  return result.data;
}
