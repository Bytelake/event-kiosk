import { NextResponse } from "next/server";
import { getSettings, prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { settingsSchema } from "@/lib/validators";
import { parseCalendarIds } from "@/lib/utils";

export async function GET() {
  const settings = await getSettings();
  const domains = await prisma.allowedDomain.findMany({ orderBy: { domain: "asc" } });

  return NextResponse.json({
    orgName: settings.orgName,
    orgLogoUrl: settings.orgLogoUrl,
    brandPrimaryColor: settings.brandPrimaryColor,
    breezeSubdomain: settings.breezeSubdomain,
    hasBreezeApiKey: Boolean(settings.breezeApiKey || process.env.BREEZE_API_KEY),
    breezeCalendarIds: parseCalendarIds(settings.breezeCalendarIds),
    lastBreezeSyncAt: settings.lastBreezeSyncAt?.toISOString() ?? null,
    lastBreezeSyncError: settings.lastBreezeSyncError,
    kioskRefreshAt: settings.kioskRefreshAt?.toISOString() ?? null,
    allowedDomains: domains.map((d) => d.domain),
  });
}

export async function PATCH(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const settings = await prisma.settings.update({
    where: { id: "default" },
    data: {
      orgName: data.orgName,
      orgLogoUrl: data.orgLogoUrl,
      brandPrimaryColor: data.brandPrimaryColor,
      breezeSubdomain: data.breezeSubdomain,
      breezeApiKey: data.breezeApiKey || undefined,
      breezeCalendarIds: data.breezeCalendarIds
        ? JSON.stringify(data.breezeCalendarIds)
        : undefined,
    },
  });

  return NextResponse.json({
    orgName: settings.orgName,
    orgLogoUrl: settings.orgLogoUrl,
    brandPrimaryColor: settings.brandPrimaryColor,
    breezeSubdomain: settings.breezeSubdomain,
    hasBreezeApiKey: Boolean(settings.breezeApiKey),
    breezeCalendarIds: parseCalendarIds(settings.breezeCalendarIds),
    lastBreezeSyncAt: settings.lastBreezeSyncAt?.toISOString() ?? null,
    lastBreezeSyncError: settings.lastBreezeSyncError,
  });
}
