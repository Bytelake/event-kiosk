import { NextResponse } from "next/server";
import { getSettings, prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { applyScheduledDisplayPower } from "@/lib/display-power";
import { parseDisplayOnDays, stringifyDisplayOnDays } from "@/lib/display-schedule";
import { deleteUploadIfUnreferenced } from "@/lib/upload-cleanup";
import { settingsSchema } from "@/lib/validators";

function serializePublicSettings(settings: Awaited<ReturnType<typeof getSettings>>) {
  return {
    orgName: settings.orgName,
    orgLogoUrl: settings.orgLogoUrl,
    kioskShowLogo: settings.kioskShowLogo,
    kioskShowOrgName: settings.kioskShowOrgName,
    brandPrimaryColor: settings.brandPrimaryColor,
    brandSecondaryColor: settings.brandSecondaryColor,
    kioskBackgroundColor: settings.kioskBackgroundColor,
    kioskTextColor: settings.kioskTextColor,
    kioskMutedTextColor: settings.kioskMutedTextColor,
    kioskPrimaryFont: settings.kioskPrimaryFont,
    kioskSecondaryFont: settings.kioskSecondaryFont,
    kioskIdleTimeoutSeconds: settings.kioskIdleTimeoutSeconds,
    kioskBackgroundAnimated: settings.kioskBackgroundAnimated,
    kioskBackgroundStyle: settings.kioskBackgroundStyle,
    kioskBackgroundImageUrl: settings.kioskBackgroundImageUrl,
    registrationDomainEnforcement: settings.registrationDomainEnforcement,
    kioskDisplayEnabled: settings.kioskDisplayEnabled,
    kioskDisplayScheduleEnabled: settings.kioskDisplayScheduleEnabled,
    kioskDisplayOnDays: parseDisplayOnDays(settings.kioskDisplayOnDays),
    kioskDisplayOnTime: settings.kioskDisplayOnTime,
    kioskDisplayOffTime: settings.kioskDisplayOffTime,
    kioskDisplayIdleOffSeconds: settings.kioskDisplayIdleOffSeconds,
  };
}

export async function GET() {
  const settings = await getSettings();
  const domains = await prisma.allowedDomain.findMany({ orderBy: { domain: "asc" } });

  return NextResponse.json({
    ...serializePublicSettings(settings),
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
  const existing = await getSettings();
  const previousLogoUrl = existing.orgLogoUrl;
  const previousBackgroundImageUrl = existing.kioskBackgroundImageUrl;
  const settings = await prisma.settings.update({
    where: { id: "default" },
    data: {
      orgName: data.orgName,
      orgLogoUrl: data.orgLogoUrl,
      kioskShowLogo: data.kioskShowLogo,
      kioskShowOrgName: data.kioskShowOrgName,
      brandPrimaryColor: data.brandPrimaryColor,
      brandSecondaryColor: data.brandSecondaryColor,
      kioskBackgroundColor: data.kioskBackgroundColor,
      kioskTextColor: data.kioskTextColor,
      kioskMutedTextColor: data.kioskMutedTextColor,
      kioskPrimaryFont: data.kioskPrimaryFont,
      kioskSecondaryFont: data.kioskSecondaryFont,
      kioskIdleTimeoutSeconds: data.kioskIdleTimeoutSeconds,
      kioskBackgroundAnimated: data.kioskBackgroundAnimated,
      kioskBackgroundStyle: data.kioskBackgroundStyle,
      kioskBackgroundImageUrl: data.kioskBackgroundImageUrl,
      registrationDomainEnforcement: data.registrationDomainEnforcement,
      kioskDisplayEnabled: data.kioskDisplayEnabled,
      kioskDisplayScheduleEnabled: data.kioskDisplayScheduleEnabled,
      kioskDisplayOnDays:
        data.kioskDisplayOnDays !== undefined
          ? stringifyDisplayOnDays(data.kioskDisplayOnDays)
          : undefined,
      kioskDisplayOnTime: data.kioskDisplayOnTime,
      kioskDisplayOffTime: data.kioskDisplayOffTime,
      kioskDisplayIdleOffSeconds: data.kioskDisplayIdleOffSeconds,
      settingsUpdatedAt: new Date(),
    },
  });

  if (previousLogoUrl !== settings.orgLogoUrl) {
    await deleteUploadIfUnreferenced(previousLogoUrl);
  }

  if (previousBackgroundImageUrl !== settings.kioskBackgroundImageUrl) {
    await deleteUploadIfUnreferenced(previousBackgroundImageUrl);
  }

  if (
    data.kioskDisplayEnabled !== undefined ||
    data.kioskDisplayScheduleEnabled !== undefined ||
    data.kioskDisplayOnDays !== undefined ||
    data.kioskDisplayOnTime !== undefined ||
    data.kioskDisplayOffTime !== undefined ||
    data.kioskDisplayIdleOffSeconds !== undefined
  ) {
    void applyScheduledDisplayPower(settings).catch((err) => {
      console.warn("[display-power] Failed to apply HDMI power after settings save:", err);
    });
  }

  return NextResponse.json(serializePublicSettings(settings));
}
