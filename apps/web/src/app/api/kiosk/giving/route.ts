import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatValidationError, kioskGivingSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = kioskGivingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatValidationError(parsed.error) }, { status: 400 });
  }

  const { name, email, phone } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const now = Date.now();
  const duplicateSince = new Date(now - DUPLICATE_WINDOW_MS);
  const rateLimitSince = new Date(now - RATE_LIMIT_WINDOW_MS);

  const [recentDuplicate, recentCount] = await Promise.all([
    prisma.inquiry.findFirst({
      where: {
        kind: "giving",
        email: normalizedEmail,
        createdAt: { gte: duplicateSince },
      },
      select: { id: true },
    }),
    prisma.inquiry.count({
      where: {
        kind: "giving",
        createdAt: { gte: rateLimitSince },
      },
    }),
  ]);

  if (recentDuplicate) {
    return NextResponse.json(
      { error: "We already received your information. Please check back later." },
      { status: 429 },
    );
  }

  if (recentCount >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "Too many submissions right now. Please try again in a minute." },
      { status: 429 },
    );
  }

  const inquiry = await prisma.inquiry.create({
    data: {
      kind: "giving",
      name,
      email: normalizedEmail,
      phone: phone ?? null,
      emailStatus: "skipped",
    },
  });

  return NextResponse.json({ ok: true, id: inquiry.id }, { status: 201 });
}
