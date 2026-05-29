import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const siteSettingsSchema = z.object({
  hotel_name: z.string().trim().min(1).max(200),
  tagline: optionalText,
  address: optionalText,
  contact_phone: optionalText,
  contact_email: z
    .string()
    .trim()
    .email()
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  currency: z.string().trim().length(3).toUpperCase(),
  currency_symbol: z.string().trim().min(1).max(8),
  timezone: z.string().trim().min(1).max(64),
  tax_rate: z.coerce.number().min(0).max(0.9999),
  service_charge_rate: z.coerce.number().min(0).max(0.9999),
  google_place_id: optionalText,
});

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/i, "Must be a #RRGGBB hex color");

export const brandingSchema = z.object({
  primary_color: hexColor,
  secondary_color: hexColor,
  accent_color: hexColor,
  font_family: z.string().trim().min(1).max(120),
});

export const faqSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(5000),
  category: optionalText,
  sort_order: z.coerce.number().int().min(0).default(0),
  is_visible: z.coerce.boolean().default(true),
});

export const amenitySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  icon: optionalText,
  description: optionalText,
  sort_order: z.coerce.number().int().min(0).default(0),
  is_visible: z.coerce.boolean().default(true),
});

export const testimonialSchema = z.object({
  id: z.string().uuid().optional(),
  author_name: z.string().trim().min(1).max(120),
  author_role: optionalText,
  body: z.string().trim().min(1).max(2000),
  rating: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().int().min(1).max(5).optional(),
  ),
  image_url: optionalText,
  sort_order: z.coerce.number().int().min(0).default(0),
  is_visible: z.coerce.boolean().default(true),
});

export const galleryImageSchema = z.object({
  id: z.string().uuid().optional(),
  image_url: z.string().trim().url().max(2000),
  caption: optionalText,
  category: optionalText,
  sort_order: z.coerce.number().int().min(0).default(0),
  is_visible: z.coerce.boolean().default(true),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
export type BrandingInput = z.infer<typeof brandingSchema>;
export type FaqInput = z.infer<typeof faqSchema>;
export type AmenityInput = z.infer<typeof amenitySchema>;
export type TestimonialInput = z.infer<typeof testimonialSchema>;
export type GalleryImageInput = z.infer<typeof galleryImageSchema>;
