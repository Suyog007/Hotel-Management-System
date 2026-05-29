import { z } from "zod";

export const SECTION_TYPES = ["hero", "text", "gallery", "cta", "faq"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

const optionalText = z
  .string()
  .trim()
  .max(10000)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalUrl = z
  .string()
  .trim()
  .url()
  .or(z.literal(""))
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const heroContent = z.object({
  heading: optionalText,
  subheading: optionalText,
  image_url: optionalUrl,
  cta_label: optionalText,
  cta_href: optionalText,
});

export const textContent = z.object({
  heading: optionalText,
  body: optionalText,
});

export const galleryContent = z.object({
  heading: optionalText,
  image_ids: z.array(z.string().uuid()).default([]),
});

export const ctaContent = z.object({
  heading: optionalText,
  body: optionalText,
  cta_label: optionalText,
  cta_href: optionalText,
});

export const faqContent = z.object({
  heading: optionalText,
  category: optionalText,
});

export type HeroContent = z.infer<typeof heroContent>;
export type TextContent = z.infer<typeof textContent>;
export type GalleryContent = z.infer<typeof galleryContent>;
export type CtaContent = z.infer<typeof ctaContent>;
export type FaqContent = z.infer<typeof faqContent>;

export function parseSectionContent(type: SectionType, content: unknown) {
  switch (type) {
    case "hero":
      return heroContent.parse(content ?? {});
    case "text":
      return textContent.parse(content ?? {});
    case "gallery":
      return galleryContent.parse(content ?? {});
    case "cta":
      return ctaContent.parse(content ?? {});
    case "faq":
      return faqContent.parse(content ?? {});
  }
}

export function defaultSectionContent(type: SectionType) {
  switch (type) {
    case "hero":
      return { heading: "", subheading: "", image_url: "", cta_label: "", cta_href: "" };
    case "text":
      return { heading: "", body: "" };
    case "gallery":
      return { heading: "", image_ids: [] as string[] };
    case "cta":
      return { heading: "", body: "", cta_label: "", cta_href: "" };
    case "faq":
      return { heading: "", category: "" };
  }
}

export const pageMetaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  meta_title: z.string().trim().max(200).optional().transform((v) => (v === "" ? undefined : v)),
  meta_description: z.string().trim().max(500).optional().transform((v) => (v === "" ? undefined : v)),
  is_published: z.boolean().default(true),
});

export type PageMetaInput = z.infer<typeof pageMetaSchema>;
