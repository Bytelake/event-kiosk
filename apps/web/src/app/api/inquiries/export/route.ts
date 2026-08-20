import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth";
import { formatWallClockDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(values: string[]): string {
  return values.map(csvCell).join(",");
}

export async function POST() {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const inquiries = await prisma.inquiry.findMany({
    orderBy: { createdAt: "desc" },
  });

  const header = toCsvRow([
    "Created",
    "Kind",
    "Name",
    "Email",
    "Phone",
    "Message",
    "Email Status",
  ]);

  const rows = inquiries.map((inquiry) =>
    toCsvRow([
      formatWallClockDateTime(inquiry.createdAt),
      inquiry.kind,
      inquiry.name,
      inquiry.email,
      inquiry.phone ?? "",
      inquiry.message ?? "",
      inquiry.emailStatus,
    ]),
  );

  const csv = [header, ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inquiries-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
