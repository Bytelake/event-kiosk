import { z } from "zod";
import { KIOSK_BACKGROUND_STYLES } from "@/lib/kiosk-background";
import { isSafeStoredMediaUrl } from "@/lib/media-url";
import { normalizeAllowedDomain, normalizeRegistrationUrl } from "@/lib/registration-domains";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();

export const loginSchema = z.object({
  password: z.string().min(1).max(1024),
});

const mediaUrlSchema = z
  .string()
  .max(2048)
  .optional()
  .nullable()
  .refine(
    (value) => !value || isSafeStoredMediaUrl(value),
    "Must be an uploaded /uploads/… path or https URL",
  );

export const manualEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  startAt: z.string().min(1).max(40),
  endAt: z.string().max(40).optional().nullable(),
  allDay: z.boolean().optional(),
  shortDescription: optionalText(500),
  fullDescription: optionalText(20_000),
  location: optionalText(200),
  imageUrl: mediaUrlSchema,
  registrationUrl: z
    .string()
    .max(2048)
    .optional()
    .nullable()
    .refine((value) => {
      if (!value) return true;
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "Must be an https URL"),
  urlLabel: z.enum(["register", "learn_more"]).optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
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
  orgName: z.string().trim().min(1).max(120).optional(),
  orgLogoUrl: mediaUrlSchema,
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
  kioskBackgroundImageUrl: mediaUrlSchema,
  registrationDomainEnforcement: z.boolean().optional(),
  newsletterEnabled: z.boolean().optional(),
  newsletterTitle: z.string().trim().max(80).optional(),
  newsletterBody: z.string().max(4_000).optional(),
  newsletterUrl: z.preprocess(
    (val) => {
      if (val === undefined) return undefined;
      if (typeof val !== "string" || !val.trim()) return "";
      return normalizeRegistrationUrl(val);
    },
    z.string().url().max(2048).or(z.literal("")).optional(),
  ),
  newsletterButtonLabel: z.string().trim().max(40).optional(),
  givingEnabled: z.boolean().optional(),
  givingTitle: z.string().trim().max(80).optional(),
  givingBody: z.string().max(4_000).optional(),
  givingSuccessMessage: z.string().max(4_000).optional(),
  givingNotifyEmail: z.string().email().max(254).optional().or(z.literal("")),
  givingVisitorEmailSubject: z.string().max(200).optional(),
  givingVisitorEmailBody: z.string().max(8_000).optional(),
  kioskDisplayEnabled: z.boolean().optional(),
  kioskDisplayScheduleEnabled: z.boolean().optional(),
  kioskDisplayOnDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  kioskDisplayOnTime: hhMmSchema.optional(),
  kioskDisplayOffTime: hhMmSchema.optional(),
  kioskDisplayIdleOffSeconds: z.number().int().min(0).max(86_400).optional(),
});

export const kioskGivingSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Valid email is required").max(254),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export const allowedDomainSchema = z.object({
  domain: z
    .string()
    .min(1)
    .max(253)
    .transform((value, ctx) => {
      const domain = normalizeAllowedDomain(value);
      if (!domain) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Must be a hostname such as example.com",
        });
        return z.NEVER;
      }
      return domain;
    }),
});
