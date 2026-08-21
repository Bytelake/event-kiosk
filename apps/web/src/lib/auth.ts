import { createHash, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const COOKIE_NAME = "kiosk_admin_session";
const SESSION_DURATION = 60 * 60 * 24 * 7;
const ADMIN_ROLE = "admin";
const MIN_SESSION_SECRET_LENGTH = 16;

const INSECURE_SESSION_SECRETS = new Set([
  "change-this-to-a-long-random-string",
  "changeme",
  "secret",
  "session_secret",
]);

const INSECURE_ADMIN_PASSWORDS = new Set(["changeme", "password", "admin", "kiosk"]);

export { COOKIE_NAME };

export function sessionCookieOptions() {
  // Default to non-secure cookies so HTTP kiosk/admin works on the Pi.
  // Set COOKIE_SECURE=true when serving admin over HTTPS.
  const secure = process.env.COOKIE_SECURE === "true";

  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION,
  };
}

function normalizeEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function digestUtf8(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function secretsEqual(left: string, right: string): boolean {
  return timingSafeEqual(digestUtf8(left), digestUtf8(right));
}

function isInsecureSessionSecret(secret: string): boolean {
  return secret.length < MIN_SESSION_SECRET_LENGTH || INSECURE_SESSION_SECRETS.has(secret);
}

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return new TextEncoder().encode(normalizeEnvValue(secret));
}

export function warnIfInsecureAuthConfig() {
  const sessionSecret = process.env.SESSION_SECRET
    ? normalizeEnvValue(process.env.SESSION_SECRET)
    : "";
  if (!sessionSecret || isInsecureSessionSecret(sessionSecret)) {
    console.warn(
      "[auth] SESSION_SECRET is missing, short, or using a default value. Generate a long random secret in /var/lib/kiosk/.env (or apps/web/.env).",
    );
  }

  const adminPassword = process.env.ADMIN_PASSWORD
    ? normalizeEnvValue(process.env.ADMIN_PASSWORD)
    : "";
  if (!adminPassword || INSECURE_ADMIN_PASSWORDS.has(adminPassword)) {
    console.warn(
      "[auth] ADMIN_PASSWORD is missing or still a default/common value. Change it before exposing admin on the network.",
    );
  }
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  const normalized = normalizeEnvValue(adminPassword);
  if (normalized.startsWith("$2")) {
    return bcrypt.compare(password, normalized);
  }
  return secretsEqual(password, normalized);
}

export async function createSession(): Promise<string> {
  return new SignJWT({ role: ADMIN_ROLE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(ADMIN_ROLE)
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = typeof payload.role === "string" ? payload.role : undefined;
    return payload.sub === ADMIN_ROLE || role === ADMIN_ROLE;
  } catch {
    return false;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, sessionCookieOptions());
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySession(token);
}

export async function unauthorizedResponse(): Promise<NextResponse> {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireApiAuth(): Promise<NextResponse | null> {
  const ok = await isAuthenticated();
  if (ok) return null;
  return unauthorizedResponse();
}
