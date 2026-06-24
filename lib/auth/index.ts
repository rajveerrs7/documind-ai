// ─────────────────────────────────────────────────────────────────────────────
// Authentication Utilities
//
// Handles:
//   1. Password hashing/verification with bcrypt
//   2. JWT creation and verification with jose
//   3. Token extraction from request headers/cookies
//
// We use jose (not jsonwebtoken) because:
//   - jose works in Edge Runtime (middleware)
//   - jsonwebtoken requires Node.js crypto APIs
//   - jose is the recommended library for Next.js App Router
//
// JWT Strategy:
//   - Token stored in httpOnly cookie (XSS protection)
//   - Also accepted in Authorization header (for API clients)
//   - Token contains: userId, email, role
//   - Expiry: 7 days (configurable via JWT_EXPIRES_IN)
//   - Logout: token ID blacklisted in Redis until natural expiry
// ─────────────────────────────────────────────────────────────────────────────

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { isTokenBlacklisted } from "@/lib/redis";
import type { JWTPayload, AuthUser } from "@/types";
import { Role } from "@prisma/client";

// ── Constants ─────────────────────────────────────────────────────────────────

export const COOKIE_NAME = "documind_session";
const BCRYPT_ROUNDS = 12; // Cost factor — higher = slower = more secure

// JWT expiry in seconds (7 days)
const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

// ── Secret Key ────────────────────────────────────────────────────────────────

/**
 * Gets the JWT secret as a Uint8Array (required by jose).
 * jose needs the secret in this format for HMAC signing.
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is not set. " +
        "Generate one with: openssl rand -base64 64",
    );
  }
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }
  return new TextEncoder().encode(secret);
}

// ── Password Utilities ────────────────────────────────────────────────────────

/**
 * Hashes a plaintext password using bcrypt.
 *
 * 12 rounds is the current recommendation:
 *   - Fast enough for good UX (~300ms)
 *   - Slow enough to resist brute force
 *
 * @param password - Plaintext password from registration form
 * @returns Promise<string> - bcrypt hash to store in database
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 *
 * Uses bcrypt.compare which is timing-safe (constant-time comparison).
 * This prevents timing attacks that could leak password information.
 *
 * @param password - Plaintext password from login form
 * @param hash - bcrypt hash from database
 * @returns Promise<boolean> - true if password matches
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT Utilities ─────────────────────────────────────────────────────────────

/**
 * Creates a signed JWT token for an authenticated user.
 *
 * The token contains minimal user info (userId, email, role).
 * We don't store sensitive data in the token since it's readable
 * by the client (though not forgeable without the secret).
 *
 * We include a unique JWT ID (jti) for blacklisting on logout.
 *
 * @param payload - User data to encode in the token
 * @returns Promise<string> - Signed JWT string
 */
export async function createToken(
  payload: Omit<JWTPayload, "iat" | "exp">,
): Promise<string> {
  const secret = getJwtSecret();

  // Generate a unique token ID for blacklisting
  const jti = `${payload.userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const token = await new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" }) // HMAC-SHA256 signing
    .setIssuedAt() // iat claim
    .setExpirationTime(`${JWT_EXPIRY_SECONDS}s`) // exp claim
    .setJti(jti) // Unique token ID
    .setIssuer("documind-ai") // iss claim
    .setAudience("documind-ai-users") // aud claim
    .sign(secret);

  return token;
}

/**
 * Verifies a JWT token and returns the decoded payload.
 *
 * Checks:
 *   1. Signature validity (tamper detection)
 *   2. Expiry (exp claim)
 *   3. Issuer and audience
 *   4. Redis blacklist (for logged-out tokens)
 *
 * @param token - JWT string to verify
 * @returns Promise<JWTPayload> - Decoded and verified payload
 * @throws {Error} If token is invalid, expired, or blacklisted
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
  const secret = getJwtSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: "documind-ai",
      audience: "documind-ai-users",
    });

    // Check blacklist (for logged-out tokens)
    const jti = payload.jti;
    if (jti) {
      const blacklisted = await isTokenBlacklisted(jti);
      if (blacklisted) {
        throw new Error("Token has been revoked");
      }
    }

    // Validate required fields are present
    if (!payload.userId || !payload.email || !payload.role) {
      throw new Error("Token is missing required fields");
    }

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as Role,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw with cleaner message
      if (error.message.includes("expired")) {
        throw new Error("Session expired. Please log in again.");
      }
      if (error.message.includes("revoked")) {
        throw new Error("Session revoked. Please log in again.");
      }
      throw new Error("Invalid session. Please log in again.");
    }
    throw new Error("Authentication failed");
  }
}

// ── Token Extraction ──────────────────────────────────────────────────────────

/**
 * Extracts JWT token from a Next.js Request.
 *
 * Checks in order:
 *   1. Authorization header: "Bearer <token>"
 *   2. Cookie: documind_session=<token>
 *
 * @param request - Next.js NextRequest object
 * @returns Token string or null if not found
 */
export function extractTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header first (for API clients)
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  // Check cookie (for browser clients)
  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * Extracts JWT token from Next.js server-side cookies.
 * Used in Server Components and Route Handlers (not middleware).
 *
 * @returns Token string or null
 */
export async function extractTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

// ── Auth User Resolution ──────────────────────────────────────────────────────

/**
 * Gets the currently authenticated user from a request.
 *
 * This is the main function used by API route handlers to
 * identify who is making the request.
 *
 * @param request - Next.js NextRequest
 * @returns AuthUser if authenticated, null if not
 */
export async function getAuthUserFromRequest(
  request: NextRequest,
): Promise<AuthUser | null> {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return null;

    const payload = await verifyToken(token);

    return {
      id: payload.userId,
      email: payload.email,
      name: null, // Name not stored in token — fetch from DB if needed
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/**
 * Gets the currently authenticated user from server-side cookies.
 * Used in Server Components.
 *
 * @returns AuthUser if authenticated, null if not
 */
export async function getAuthUserFromCookies(): Promise<AuthUser | null> {
  try {
    const token = await extractTokenFromCookies();
    if (!token) return null;

    const payload = await verifyToken(token);

    return {
      id: payload.userId,
      email: payload.email,
      name: null,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

// ── Cookie Management ─────────────────────────────────────────────────────────

/**
 * Cookie options for the session cookie.
 *
 * Security settings:
 *   - httpOnly: Cannot be accessed by JavaScript (XSS protection)
 *   - secure: Only sent over HTTPS in production
 *   - sameSite: "lax" prevents CSRF while allowing normal navigation
 *   - path: "/": Available throughout the app
 */
export function getSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: JWT_EXPIRY_SECONDS,
  };
}

// ── Authorization Helpers ─────────────────────────────────────────────────────

/**
 * Checks if a user has admin role.
 *
 * @param user - AuthUser object
 * @returns boolean
 */
export function isAdmin(user: AuthUser): boolean {
  return user.role === Role.ADMIN;
}

/**
 * Requires authentication — throws if not authenticated.
 * Used as a guard in API route handlers.
 *
 * @param request - NextRequest
 * @returns AuthUser (guaranteed to be non-null)
 * @throws {Error} With HTTP 401 status hint
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    throw new AuthError("Authentication required", 401);
  }
  return user;
}

/**
 * Requires admin role — throws if not admin.
 *
 * @param request - NextRequest
 * @returns AuthUser with admin role guaranteed
 * @throws {AuthError} With HTTP 403 if not admin
 */
export async function requireAdmin(request: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (!isAdmin(user)) {
    throw new AuthError("Admin access required", 403);
  }
  return user;
}

// ── Custom Error Class ────────────────────────────────────────────────────────

/**
 * Custom error class for authentication errors.
 * Carries HTTP status code for proper API responses.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
