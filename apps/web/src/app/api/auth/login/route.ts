import { NextResponse } from "next/server";
import {
  createSession,
  isAuthenticated,
  sessionCookieOptions,
  verifyAdminPassword,
  clearSessionCookie,
  COOKIE_NAME,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const valid = await verifyAdminPassword(parsed.data.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = await createSession();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, token, sessionCookieOptions());
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const ok = await isAuthenticated();
    return NextResponse.json({ authenticated: ok });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth check failed";
    return NextResponse.json({ authenticated: false, error: message }, { status: 500 });
  }
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
