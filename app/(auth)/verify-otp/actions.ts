"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { verifyOtpSchema } from "@/lib/validation/auth";

export async function verifyOtp(formData: FormData) {
  const parsed = verifyOtpSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    const email = (formData.get("email") as string) || "";
    const qs = new URLSearchParams({ email, error: "Invalid input." });
    redirect(`/verify-otp?${qs.toString()}`);
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error || !data.session || !data.user) {
    const qs = new URLSearchParams({
      email: parsed.data.email,
      error: "Invalid or expired code.",
    });
    if (parsed.data.next) qs.set("next", parsed.data.next);
    redirect(`/verify-otp?${qs.toString()}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", data.user.id)
    .single();
  const role = (profile?.role as string | undefined) ?? "guest";

  await writeAudit({
    action: "login",
    entityType: "auth.users",
    entityId: data.user.id,
    newValues: { role },
  });

  if (parsed.data.next) redirect(parsed.data.next);
  if (role === "super_admin") redirect("/admin");
  if (role === "manager" || role === "receptionist") redirect("/dashboard");
  redirect("/");
}
