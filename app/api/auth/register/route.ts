// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
//
// Creates a new user account.
//
// Flow:
//   1. Validate input (email, password, name)
//   2. Check if email already exists
//   3. Hash password with bcrypt
//   4. Create user in Prisma (role: ADMIN if admin email, else USER)
//   5. Create JWT token
//   6. Set session cookie
//   7. Return user data (without password)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { hashPassword, createToken, getSessionCookieOptions } from "@/lib/auth";
import { RegisterSchema, formatZodError } from "@/lib/validators";
import { Role } from "@prisma/client";
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
    const validationResult = RegisterSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: formatZodError(validationResult.error),
        },
        { status: 400 },
      );
    }

    const { email, password, name } = validationResult.data;

    // ── Check if email already registered ─────────────────────
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }, // Only select ID — we don't need other fields
    });

    if (existingUser) {
      // Use a generic message to avoid email enumeration attacks
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "An account with this email already exists",
        },
        { status: 409 }, // 409 Conflict
      );
    }

    // ── Hash password ──────────────────────────────────────────
    const hashedPassword = await hashPassword(password);

    // ── Determine role ─────────────────────────────────────────
    // The first user with ADMIN_EMAIL gets admin role automatically
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    const role: Role =
      email.toLowerCase() === adminEmail ? Role.ADMIN : Role.USER;

    // ── Create user in database ────────────────────────────────
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role,
      },
      // Never return the password hash
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // ── Create JWT token ───────────────────────────────────────
    const token = await createToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    // ── Build response ─────────────────────────────────────────
    const response = NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          user: newUser,
          message: "Account created successfully",
        },
      },
      { status: 201 },
    );

    // ── Set session cookie ─────────────────────────────────────
    const cookieOptions = getSessionCookieOptions();
    response.cookies.set({
      ...cookieOptions,
      value: token,
    });

    console.log(`[Auth] New user registered: ${email} (role: ${role})`);

    return response;
  } catch (error) {
    console.error("[Auth/Register] Unexpected error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Registration failed. Please try again.",
      },
      { status: 500 },
    );
  }
}
