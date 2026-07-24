import { z } from "zod";

/**
 * A post-login redirect target. Must be a same-origin absolute path ("/...")
 * and never a protocol-relative ("//evil.com") or absolute URL, so a crafted
 * ?next= link can't bounce an authenticated user to an attacker's site.
 */
export const nextPathSchema = z
  .string()
  .trim()
  .max(512)
  .refine((v) => v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\"), {
    message: "Invalid redirect target",
  });

/** Returns `next` if it's a safe same-origin path, else null. */
export function safeNextPath(next: string | undefined | null): string | null {
  if (!next) return null;
  const result = nextPathSchema.safeParse(next);
  return result.success ? result.data : null;
}

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Code must be 6 digits"),
  // Kept lenient here; sanitized with safeNextPath() at redirect time so a
  // malformed value strips to the default instead of failing the whole login.
  next: z.string().trim().max(512).optional(),
});

export type EmailInput = z.infer<typeof emailSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
