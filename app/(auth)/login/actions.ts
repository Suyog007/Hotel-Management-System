"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/validation/auth";

export async function requestOtp(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  const next = (formData.get("next") as string | null) || undefined;
  const from = (formData.get("from") as string | null) || undefined;

  if (!parsed.success) {
    const qs = new URLSearchParams({ error: "Please enter a valid email." });
    if (next) qs.set("next", next);
    redirect(`/login?${qs.toString()}`);
  }

  const supabase = await createServerClient();
  // shouldCreateUser=false: staff and previously-verified guests only.
  // We intentionally ignore the error so we don't leak whether the email
  // exists (enumeration). The "code sent" message is shown either way.
  await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false },
  });

  const qs = new URLSearchParams({ email: parsed.data.email });
  if (next) qs.set("next", next);
  if (from === "resend") qs.set("resent", "1");
  redirect(`/verify-otp?${qs.toString()}`);
}
