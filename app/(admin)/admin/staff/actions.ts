"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import {
  changeRoleSchema,
  inviteStaffSchema,
  toggleActiveSchema,
} from "@/lib/validation/staff";

async function requireSuperAdmin() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/admin/staff");
  const { data: actor } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const a = actor as { id: string; role: string } | null;
  if (!a || a.role !== "super_admin") {
    redirect(`/admin?error=${encodeURIComponent("Super admin only")}`);
  }
  return a;
}

function bail(msg: string): never {
  redirect(`/admin/staff?error=${encodeURIComponent(msg)}`);
}

export async function inviteStaff(formData: FormData) {
  await requireSuperAdmin();
  const parsed = inviteStaffSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
  });
  if (!parsed.success) bail(parsed.error.issues.map((i) => i.message).join("; "));

  const admin = createAdminClient();

  // Pre-create stub profile with target role so the trigger preserves it on accept.
  const { data: existing } = await admin
    .from("profiles")
    .select("id, auth_user_id")
    .eq("email", parsed.data.email)
    .maybeSingle();

  let profileId: string;
  if (existing) {
    profileId = (existing as { id: string }).id;
    await admin
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        role: parsed.data.role,
        is_active: true,
      })
      .eq("id", profileId);
  } else {
    const { data, error } = await admin
      .from("profiles")
      .insert({
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        role: parsed.data.role,
        is_stub: true,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) bail(error.message);
    profileId = (data as { id: string }).id;
  }

  // Send Supabase invite email (creates auth.users on accept)
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: { full_name: parsed.data.full_name },
    },
  );
  if (inviteErr) {
    // Profile is in place even if email sender failed — surface but don't roll back.
    bail(`Profile saved; invite email failed: ${inviteErr.message}`);
  }

  await writeAudit({
    action: "create",
    entityType: "profiles",
    entityId: profileId,
    newValues: { email: parsed.data.email, role: parsed.data.role, invited: true },
  });

  revalidatePath("/admin/staff");
  redirect("/admin/staff?saved=1");
}

export async function changeRole(formData: FormData) {
  const acting = await requireSuperAdmin();
  const parsed = changeRoleSchema.safeParse({
    profile_id: formData.get("profile_id"),
    role: formData.get("role"),
  });
  if (!parsed.success) bail(parsed.error.issues.map((i) => i.message).join("; "));

  if (parsed.data.profile_id === acting.id && parsed.data.role !== "super_admin") {
    bail("Cannot demote yourself");
  }

  const admin = createAdminClient();
  const { data: oldRow } = await admin
    .from("profiles")
    .select("email, role")
    .eq("id", parsed.data.profile_id)
    .single();
  const { error } = await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.profile_id);
  if (error) bail(error.message);

  await writeAudit({
    action: "update",
    entityType: "profiles",
    entityId: parsed.data.profile_id,
    oldValues: oldRow,
    newValues: { role: parsed.data.role },
  });

  revalidatePath("/admin/staff");
  redirect("/admin/staff?saved=1");
}

export async function toggleActive(formData: FormData) {
  const acting = await requireSuperAdmin();
  const parsed = toggleActiveSchema.safeParse({
    profile_id: formData.get("profile_id"),
    is_active: formData.get("is_active") === "true",
  });
  if (!parsed.success) bail(parsed.error.issues.map((i) => i.message).join("; "));

  if (parsed.data.profile_id === acting.id && !parsed.data.is_active) {
    bail("Cannot disable yourself");
  }

  const admin = createAdminClient();
  const { data: oldRow } = await admin
    .from("profiles")
    .select("email, is_active")
    .eq("id", parsed.data.profile_id)
    .single();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: parsed.data.is_active })
    .eq("id", parsed.data.profile_id);
  if (error) bail(error.message);

  await writeAudit({
    action: "update",
    entityType: "profiles",
    entityId: parsed.data.profile_id,
    oldValues: oldRow,
    newValues: { is_active: parsed.data.is_active },
  });

  revalidatePath("/admin/staff");
  redirect("/admin/staff?saved=1");
}
