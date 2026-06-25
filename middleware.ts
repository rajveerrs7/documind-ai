// ─────────────────────────────────────────────────────────────────────────────
// Next.js Middleware — Route Protection
//
// This middleware runs on EVERY request before it hits the route handler.
// It's the first line of defense for authentication.
//
// Runs in Edge Runtime — cannot use Node.js APIs directly.
// That's why we use jose (Edge-compatible) not jsonwebtoken.
//
// Protected route strategy:
//   - /dashboard/* → requires authentication
//   - /api/upload  → requires authentication
//   - /api/chat    → requires authentication
//   - /api/admin/* → requires ADMIN role
//   - /api/auth/*  → public (register, login)
//   - /            → public (landing page)
//
// On auth failure:
//   - Browser requests → redirect to /login
//   - API requests → 401 JSON response
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@/lib/auth/constants";

// ── Route Definitions ─────────────────────────────────────────────────────────

// Routes that require authentication (user must be logged in)
const PROTECTED_ROUTES = ["/dashboard", "/chat", "/documents", "/admin"];

// API routes that require authentication
const PROTECTED_API_ROUTES = [
  "/api/upload",
  "/api/chat",
  "/api/documents",
  "/api/admin",
];

// Routes that are only accessible when NOT authenticated
// (redirect to dashboard if already logged in)
const AUTH_ONLY_ROUTES = ["/login", "/register"];

// ── Helper: Check if path starts with any prefix ─────────────────────────────

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname.startsWith(route));
}

// ── Helper: Check if request is for an API route ─────────────────────────────

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

// ── JWT Verification (Edge-compatible) ────────────────────────────────────────

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  exp?: number;
}

/**
 * Verifies JWT token in Edge Runtime.
 * Simplified version that doesn't check Redis blacklist
 * (Redis SDK isn't Edge-compatible without special configuration).
 * Full blacklist check happens in individual route handlers.
 */
async function verifyTokenEdge(token: string): Promise<TokenPayload | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;

    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: "documind-ai",
      audience: "documind-ai-users",
    });

    if (!payload.userId || !payload.email || !payload.role) {
      return null;
    }

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
      exp: payload.exp,
    };
  } catch {
    // Token is invalid or expired
    return null;
  }
}

// ── Token Extraction ──────────────────────────────────────────────────────────

function extractToken(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  // Check cookie
  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken) return cookieToken;

  return null;
}

// ── Main Middleware Function ───────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Skip middleware for static files and Next.js internals ──
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    pathname.includes(".") // Static files (images, fonts, etc.)
  ) {
    return NextResponse.next();
  }

  // ── Extract and verify token ─────────────────────────────────
  const token = extractToken(request);
  const user = token ? await verifyTokenEdge(token) : null;
  const isAuthenticated = user !== null;

  // ── Handle auth-only routes (login, register) ─────────────────
  // If already authenticated, redirect away from login/register
  if (matchesRoute(pathname, AUTH_ONLY_ROUTES) && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── Handle protected API routes ───────────────────────────────
  if (isApiRequest(pathname) && matchesRoute(pathname, PROTECTED_API_ROUTES)) {
    if (!isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 },
      );
    }

    // Check admin routes
    if (pathname.startsWith("/api/admin") && user?.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "Admin access required",
        },
        { status: 403 },
      );
    }

    // Inject user info into request headers for route handlers
    // This avoids re-verifying the token in every route handler
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user!.userId);
    requestHeaders.set("x-user-email", user!.email);
    requestHeaders.set("x-user-role", user!.role);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // ── Handle protected page routes ──────────────────────────────
  if (matchesRoute(pathname, PROTECTED_ROUTES) && !isAuthenticated) {
    // Store the attempted URL to redirect back after login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Handle root redirect ──────────────────────────────────────
  if (pathname === "/" && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// ── Middleware Config ─────────────────────────────────────────────────────────

export const config = {
  // Apply middleware to all routes except static files
  // Using a negative lookahead to exclude Next.js internals
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
