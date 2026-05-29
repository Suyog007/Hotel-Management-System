"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { serviceRequestStatusSchema } from "@/lib/validation/services";

const STAFF_ROLES = new Set(["receptionist", "manager", "super_admin"]);

export async function updateServiceRequestStatus(formData: FormData) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/service-requests");
  const { data: actor } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const a = actor as { id: string; role: string } | null;
  if (!a || !STAFF_ROLES.has(a.role)) {
    redirect("/?error=Staff+only");
  }

  const parsed = serviceRequestStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    redirect(`/dashboard/service-requests?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join("; "))}`);
  }

  const { data: oldRow } = await supabase
    .from("service_requests")
    .select("*")
    .eq("id", parsed.data.id)
    .single();

  const { error } = await supabase
    .from("service_requests")
    .update({ status: parsed.data.status, handled_by: a.id })
    .eq("id", parsed.data.id);
  if (error) redirect(`/dashboard/service-requests?error=${encodeURIComponent(error.message)}`);

  await writeAudit({
    action: "update",
    entityType: "service_requests",
    entityId: parsed.data.id,
    oldValues: oldRow,
    newValues: { status: parsed.data.status, handled_by: a.id },
  });

  revalidatePath("/dashboard/service-requests");
  redirect("/dashboard/service-requests?saved=1");
}
