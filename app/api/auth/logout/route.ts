// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
//
// Logs out the current user by:
//   1. Extracting the current JWT token
//   2. Adding it to the Redis blacklist (so it can't be reused)
//   3. Clearing the session cookie
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@/lib/auth";
import { blacklistToken } from "@/lib/redis";
import type { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    // ── Extract token ──────────────────────────────────────────
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (token) {
      // ── Blacklist the token ──────────────────────────────────
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
        const { payload } = await jwtVerify(token, secret);

        if (payload.jti && payload.exp) {
          await blacklistToken(payload.jti, payload.exp);
        }
      } catch {
        // Token may already be expired — that's fine, still clear cookie
        console.log(
          "[Auth/Logout] Token was already invalid, clearing cookie anyway",
        );
      }
    }

    // ── Build response and clear cookie ───────────────────────
    const response = NextResponse.json<ApiResponse>(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 },
    );

    // Clear the session cookie by setting it with expired maxAge
    response.cookies.set({
      name: COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0, // Expire immediately
    });

    return response;
  } catch (error) {
    console.error("[Auth/Logout] Error:", error);
    // Even on error, try to clear the cookie
    const response = NextResponse.json<ApiResponse>(
      { success: true, message: "Logged out" },
      { status: 200 },
    );
    response.cookies.set({
      name: COOKIE_NAME,
      value: "",
      maxAge: 0,
      path: "/",
    });
    return response;
  }
}
