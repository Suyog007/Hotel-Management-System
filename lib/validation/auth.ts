import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Code must be 6 digits"),
  next: z.string().trim().max(512).optional(),
});

export type EmailInput = z.infer<typeof emailSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
