import { NextResponse } from "next/server";
import {
  createSession,
  isAuthenticated,
  setSessionCookie,
  verifyAdminPassword,
  clearSessionCookie,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
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
  await setSessionCookie(token);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const ok = await isAuthenticated();
  return NextResponse.json({ authenticated: ok });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
