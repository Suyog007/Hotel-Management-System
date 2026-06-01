import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "refund_recorded";

/**
 * Append a row to audit_logs. Resolves the actor from the current Supabase
 * session (server-side cookies). Writes via the service-role client so it
 * succeeds even when called from an action whose user-row write triggered
 * the audit (e.g., the user updating their own row).
 */
export async function writeAudit(args: {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
}) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();

  let actorId: string | null = null;
  let actorEmail: string | null = null;
  if (auth.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("auth_user_id", auth.user.id)
      .single();
    actorId = (profile?.id as string | undefined) ?? null;
    actorEmail = (profile?.email as string | undefined) ?? auth.user.email ?? null;
  }

  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    actor_email: actorEmail,
    action: args.action,
    entity_type: args.entityType,
    entity_id: args.entityId ?? null,
    old_values: (args.oldValues as Json | undefined) ?? null,
    new_values: (args.newValues as Json | undefined) ?? null,
  });
}
