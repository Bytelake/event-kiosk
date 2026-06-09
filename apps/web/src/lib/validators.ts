import { z } from "zod";

export const loginSchema = z.object({
  password: z.string().min(1),
});

export const eventEnrichSchema = z.object({
  shortDescription: z.string().optional().nullable(),
  fullDescription: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  registrationUrl: z.string().url().optional().nullable().or(z.literal("")),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  kioskVisible: z.boolean().optional(),
  allDay: z.boolean().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
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
  featured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  kioskVisible: z.boolean().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color");

export const settingsSchema = z.object({
  orgName: z.string().min(1).optional(),
  orgLogoUrl: z.string().optional().nullable(),
  brandPrimaryColor: hexColorSchema.optional(),
  brandSecondaryColor: hexColorSchema.optional(),
  kioskBackgroundColor: hexColorSchema.optional(),
  kioskTextColor: hexColorSchema.optional(),
  kioskMutedTextColor: hexColorSchema.optional(),
  breezeSubdomain: z.string().optional().nullable(),
  breezeApiKey: z.string().optional().nullable(),
  breezeCalendarIds: z.array(z.string()).optional(),
});

export const allowedDomainSchema = z.object({
  domain: z.string().min(1),
});
