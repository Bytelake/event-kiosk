import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth";
import { allowedDomainSchema } from "@/lib/validators";

export async function GET() {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const domains = await prisma.allowedDomain.findMany({ orderBy: { domain: "asc" } });
  return NextResponse.json(domains);
}

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const parsed = allowedDomainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const domain = await prisma.allowedDomain.create({
    data: { domain: parsed.data.domain },
  });

  return NextResponse.json(domain, { status: 201 });
}

export async function DELETE(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await prisma.allowedDomain.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
