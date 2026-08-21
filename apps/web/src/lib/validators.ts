import { z } from "zod";
import { KIOSK_BACKGROUND_STYLES } from "@/lib/kiosk-background";
import { normalizeRegistrationUrl } from "@/lib/registration-domains";

export const loginSchema = z.object({
  password: z.string().min(1),
});

export const manualEventSchema = z.object({
  title: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().optional().nullable(),
  allDay: z.boolean().optional(),
  shortDescription: z.string().optional().nullable(),
  fullDescription: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  registrationUrl: z.string().url().optional().nullable().or(z.literal("")),
  urlLabel: z.enum(["register", "learn_more"]).optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  kioskVisible: z.boolean().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export function formatValidationError(error: z.ZodError): string {
  const { formErrors, fieldErrors } = error.flatten();
  const parts = [
    ...formErrors,
    ...Object.entries(fieldErrors).flatMap(([field, messages]) =>
      (messages ?? []).map((message) => `${field}: ${message}`),
    ),
  ];
  return parts.join(". ") || "Invalid request";
}

export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color");

export const googleFontFamilySchema = z
  .string()
  .trim()
  .min(1, "Font name is required")
  .max(100)
  .regex(
    /^[a-zA-Z0-9]+([a-zA-Z0-9 '&\-]*[a-zA-Z0-9])?$/,
    "Must be a valid Google Font family name",
  );

export const hhMmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM (24-hour)");

export const settingsSchema = z.object({
  orgName: z.string().min(1).optional(),
  orgLogoUrl: z.string().optional().nullable(),
  kioskShowLogo: z.boolean().optional(),
  kioskShowOrgName: z.boolean().optional(),
  brandPrimaryColor: hexColorSchema.optional(),
  brandSecondaryColor: hexColorSchema.optional(),
  kioskBackgroundColor: hexColorSchema.optional(),
  kioskTextColor: hexColorSchema.optional(),
  kioskMutedTextColor: hexColorSchema.optional(),
  kioskPrimaryFont: googleFontFamilySchema.optional(),
  kioskSecondaryFont: googleFontFamilySchema.optional(),
  kioskIdleTimeoutSeconds: z.number().int().min(0).max(3600).optional(),
  kioskBackgroundAnimated: z.boolean().optional(),
  kioskBackgroundStyle: z.enum(KIOSK_BACKGROUND_STYLES).optional(),
  kioskBackgroundImageUrl: z.string().optional().nullable(),
  registrationDomainEnforcement: z.boolean().optional(),
  newsletterEnabled: z.boolean().optional(),
  newsletterTitle: z.string().optional(),
  newsletterBody: z.string().optional(),
  newsletterUrl: z.preprocess(
    (val) => {
      if (val === undefined) return undefined;
      if (typeof val !== "string" || !val.trim()) return "";
      return normalizeRegistrationUrl(val);
    },
    z.string().url().or(z.literal("")).optional(),
  ),
  newsletterButtonLabel: z.string().optional(),
  givingEnabled: z.boolean().optional(),
  givingTitle: z.string().optional(),
  givingBody: z.string().optional(),
  givingSuccessMessage: z.string().optional(),
  givingNotifyEmail: z.string().email().optional().or(z.literal("")),
  givingVisitorEmailSubject: z.string().optional(),
  givingVisitorEmailBody: z.string().optional(),
  qrScanEnabled: z.boolean().optional(),
  qrScanTitle: z.string().optional(),
  qrScanBody: z.string().optional(),
  kioskDisplayEnabled: z.boolean().optional(),
  kioskDisplayScheduleEnabled: z.boolean().optional(),
  kioskDisplayOnDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  kioskDisplayOnTime: hhMmSchema.optional(),
  kioskDisplayOffTime: hhMmSchema.optional(),
  kioskDisplayIdleOffSeconds: z.number().int().min(0).max(86_400).optional(),
});

export const inquiryEmailStatuses = ["pending", "sent", "failed", "skipped"] as const;

export const inquirySchema = z.object({
  kind: z.string().min(1).default("giving"),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  emailStatus: z.enum(inquiryEmailStatuses).optional(),
});

export const kioskGivingSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Valid email is required"),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export const allowedDomainSchema = z.object({
  domain: z.string().min(1),
});
