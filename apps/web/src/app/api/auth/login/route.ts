import { NextResponse } from "next/server";
import {
  createSession,
  isAuthenticated,
  sessionCookieOptions,
  verifyAdminPassword,
  clearSessionCookie,
  COOKIE_NAME,
} from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validators";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_CLIENT = 8;
const LOGIN_MAX_GLOBAL = 40;

function rateLimitedResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many login attempts. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

export async function POST(request: Request) {
  try {
    const ipKey = clientKey(request);
    const client = rateLimit(`login:${ipKey}`, {
      windowMs: LOGIN_WINDOW_MS,
      max: LOGIN_MAX_PER_CLIENT,
    });
    if (!client.ok) {
      return rateLimitedResponse(client.retryAfterSec);
    }

    const global = rateLimit("login:global", {
      windowMs: LOGIN_WINDOW_MS,
      max: LOGIN_MAX_GLOBAL,
    });
    if (!global.ok) {
      return rateLimitedResponse(global.retryAfterSec);
    }

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
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const ok = await isAuthenticated();
    return NextResponse.json(
      { authenticated: ok },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { authenticated: false },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
