// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
//
// Authenticates an existing user.
//
// Flow:
//   1. Validate input
//   2. Find user by email
//   3. Verify password with bcrypt (timing-safe)
//   4. Create JWT token
//   5. Set session cookie
//   6. Return user data
//
// Security notes:
//   - Same error message for "email not found" and "wrong password"
//     (prevents email enumeration)
//   - bcrypt.compare is timing-safe (constant-time)
//   - Rate limiting is handled in middleware for this route
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import {
  verifyPassword,
  createToken,
  getSessionCookieOptions,
} from "@/lib/auth";
import { LoginSchema, formatZodError } from "@/lib/validators";
import { checkRateLimit } from "@/lib/redis";
import type { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    // ── Parse request body ─────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    // ── Validate input ─────────────────────────────────────────
    const validationResult = LoginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: formatZodError(validationResult.error),
        },
        { status: 400 },
      );
    }

    const { email, password } = validationResult.data;

    // ── Rate limit login attempts by IP ────────────────────────
    // Limit to 10 login attempts per minute per IP
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateLimit = await checkRateLimit(
      `ip:${clientIp}`,
      "login",
      10, // 10 attempts
      60, // per 60 seconds
    );

    if (!rateLimit.allowed) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Too many login attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              rateLimit.resetAt - Math.floor(Date.now() / 1000),
            ),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimit.resetAt),
          },
        },
      );
    }

    // ── Find user by email ─────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true, // Need hash for verification
        role: true,
        createdAt: true,
      },
    });

    // ── Verify credentials ─────────────────────────────────────
    // IMPORTANT: We always run bcrypt.compare even if user doesn't exist
    // This prevents timing attacks that could reveal valid emails
    const dummyHash =
      "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/BDZdLuBi6";
    const passwordToVerify = user?.password || dummyHash;
    const isValidPassword = await verifyPassword(password, passwordToVerify);

    // Check both user existence AND password validity
    if (!user || !isValidPassword) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          // Generic error — don't reveal if email exists
          error: "Invalid email or password",
        },
        { status: 401 },
      );
    }

    // ── Create JWT token ───────────────────────────────────────
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // ── Build response ─────────────────────────────────────────
    const response = NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
          },
        },
      },
      { status: 200 },
    );

    // ── Set session cookie ─────────────────────────────────────
    const cookieOptions = getSessionCookieOptions();
    response.cookies.set({
      ...cookieOptions,
      value: token,
    });

    console.log(`[Auth] User logged in: ${email}`);

    return response;
  } catch (error) {
    console.error("[Auth/Login] Unexpected error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Login failed. Please try again.",
      },
      { status: 500 },
    );
  }
}
