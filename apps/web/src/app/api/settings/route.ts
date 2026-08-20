import { NextResponse } from "next/server";
import { getSettings, prisma } from "@/lib/db";
import { isAuthenticated, requireApiAuth } from "@/lib/auth";
import { applyScheduledDisplayPower } from "@/lib/display-power";
import { parseDisplayOnDays, stringifyDisplayOnDays } from "@/lib/display-schedule";
import { normalizeRegistrationUrl } from "@/lib/registration-domains";
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
    newsletterEnabled: settings.newsletterEnabled,
    newsletterTitle: settings.newsletterTitle,
    newsletterBody: settings.newsletterBody,
    newsletterUrl: settings.newsletterUrl,
    newsletterButtonLabel: settings.newsletterButtonLabel,
    givingEnabled: settings.givingEnabled,
    givingTitle: settings.givingTitle,
    givingBody: settings.givingBody,
    givingSuccessMessage: settings.givingSuccessMessage,
    kioskDisplayEnabled: settings.kioskDisplayEnabled,
    kioskDisplayScheduleEnabled: settings.kioskDisplayScheduleEnabled,
    kioskDisplayOnDays: parseDisplayOnDays(settings.kioskDisplayOnDays),
    kioskDisplayOnTime: settings.kioskDisplayOnTime,
    kioskDisplayOffTime: settings.kioskDisplayOffTime,
    kioskDisplayIdleOffSeconds: settings.kioskDisplayIdleOffSeconds,
  };
}

function serializeStaffSettings(settings: Awaited<ReturnType<typeof getSettings>>) {
  return {
    givingNotifyEmail: settings.givingNotifyEmail,
    givingVisitorEmailSubject: settings.givingVisitorEmailSubject,
    givingVisitorEmailBody: settings.givingVisitorEmailBody,
  };
}

function serializeSettings(
  settings: Awaited<ReturnType<typeof getSettings>>,
  includeStaff: boolean,
) {
  if (!includeStaff) return serializePublicSettings(settings);
  return { ...serializePublicSettings(settings), ...serializeStaffSettings(settings) };
}

function definedSettingsFields<T extends Record<string, unknown>>(fields: T) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export async function GET() {
  const settings = await getSettings();
  const domains = await prisma.allowedDomain.findMany({ orderBy: { domain: "asc" } });
  let authed = false;
  try {
    authed = await isAuthenticated();
  } catch {
    authed = false;
  }

  return NextResponse.json({
    ...serializeSettings(settings, authed),
    kioskRefreshAt: settings.kioskRefreshAt?.toISOString() ?? null,
    allowedDomains: domains.map((d) => d.domain),
  });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const existing = await getSettings();
  const previousLogoUrl = existing.orgLogoUrl;
  const previousBackgroundImageUrl = existing.kioskBackgroundImageUrl;

  let settings: Awaited<ReturnType<typeof getSettings>>;
  try {
    settings = await prisma.settings.update({
      where: { id: "default" },
      data: {
        ...definedSettingsFields({
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
          newsletterEnabled: data.newsletterEnabled,
          newsletterTitle: data.newsletterTitle,
          newsletterBody: data.newsletterBody,
          newsletterUrl:
            data.newsletterUrl !== undefined
              ? data.newsletterUrl
                ? normalizeRegistrationUrl(data.newsletterUrl)
                : ""
              : undefined,
          newsletterButtonLabel: data.newsletterButtonLabel,
          givingEnabled: data.givingEnabled,
          givingTitle: data.givingTitle,
          givingBody: data.givingBody,
          givingSuccessMessage: data.givingSuccessMessage,
          givingNotifyEmail: data.givingNotifyEmail,
          givingVisitorEmailSubject: data.givingVisitorEmailSubject,
          givingVisitorEmailBody: data.givingVisitorEmailBody,
          kioskDisplayEnabled: data.kioskDisplayEnabled,
          kioskDisplayScheduleEnabled: data.kioskDisplayScheduleEnabled,
          kioskDisplayOnDays:
            data.kioskDisplayOnDays !== undefined
              ? stringifyDisplayOnDays(data.kioskDisplayOnDays)
              : undefined,
          kioskDisplayOnTime: data.kioskDisplayOnTime,
          kioskDisplayOffTime: data.kioskDisplayOffTime,
          kioskDisplayIdleOffSeconds: data.kioskDisplayIdleOffSeconds,
        }),
        settingsUpdatedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save settings";
    console.error("[settings] PATCH failed:", err);
    if (message.includes("Unknown argument")) {
      return NextResponse.json(
        {
          error:
            "Database client is out of date. Stop the dev server, run npm run db:generate --workspace=web, then restart.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

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

  return NextResponse.json(serializeSettings(settings, true));
}
