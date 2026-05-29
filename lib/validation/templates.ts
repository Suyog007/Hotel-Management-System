import { z } from "zod";

export const emailTemplateSchema = z.object({
  subject: z.string().trim().min(1).max(500),
  body_html: z.string().trim().min(1).max(50000),
  body_text: z
    .string()
    .trim()
    .max(20000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  is_active: z.boolean().default(true),
});

export const notificationTemplateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
  is_active: z.boolean().default(true),
});

export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;
export type NotificationTemplateInput = z.infer<typeof notificationTemplateSchema>;
