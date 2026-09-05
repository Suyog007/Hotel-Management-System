import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormActions } from "@/components/ui/form-actions";
import { StatusNote } from "@/components/ui/status-note";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { changeRole, inviteStaff, toggleActive } from "./actions";

type StaffRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: "receptionist" | "manager" | "super_admin";
  is_active: boolean;
  is_stub: boolean;
  auth_user_id: string | null;
  created_at: string;
};

export default async function AdminStaffPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, is_stub, auth_user_id, created_at")
    .in("role", ["receptionist", "manager", "super_admin"])
    .order("role")
    .order("created_at");
  const rows = (data as StaffRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Team"
        title="Staff"
        description="Invite, promote, disable. Guests use a separate flow at booking time."
      />

      <StatusNote saved={sp.saved} error={sp.error} />

      <Card>
        <CardHeader>
          <CardTitle>Invite</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={inviteStaff} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input name="full_name" required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select name="role" defaultValue="receptionist">
                  <option value="receptionist">Receptionist</option>
                  <option value="manager">Manager</option>
                  <option value="super_admin">Super admin</option>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Creates a stub profile with the chosen role, then sends a Supabase invite
              email. When the invitee accepts, the trigger links their auth user to the
              stub and the role is preserved.
            </p>
            <FormActions>
              <SubmitButton size="sm">Send invite</SubmitButton>
            </FormActions>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {rows.length === 0 && (
          <EmptyState
            icon={Users}
            title="No staff yet"
            description="Invite your first team member using the form above."
          />
        )}
        {rows.map((s) => (
          <Card key={s.id} className={s.is_active ? "" : "opacity-60"}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={s.full_name} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-sm text-muted-foreground">{s.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {s.is_stub && <Badge variant="warning">Invite pending</Badge>}
                  <Badge variant="outline">{s.role.replace("_", " ")}</Badge>
                  {!s.is_active && <Badge variant="danger">Disabled</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-3">
                <form action={changeRole} className="flex items-center gap-2">
                  <input type="hidden" name="profile_id" value={s.id} />
                  <Select name="role" defaultValue={s.role} className="h-9 w-auto">
                    <option value="receptionist">Receptionist</option>
                    <option value="manager">Manager</option>
                    <option value="super_admin">Super admin</option>
                  </Select>
                  <SubmitButton size="sm" variant="outline">Set role</SubmitButton>
                </form>
                <form action={toggleActive}>
                  <input type="hidden" name="profile_id" value={s.id} />
                  <input type="hidden" name="is_active" value={s.is_active ? "false" : "true"} />
                  <SubmitButton size="sm" variant={s.is_active ? "destructive" : "default"}>
                    {s.is_active ? "Disable" : "Re-enable"}
                  </SubmitButton>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
