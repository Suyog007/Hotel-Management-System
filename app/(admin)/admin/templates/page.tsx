import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusNote } from "@/components/ui/status-note";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";
import {
  updateEmailTemplate,
  updateNotificationTemplate,
} from "./actions";

type EmailTemplate = {
  key: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: string[] | null;
  is_active: boolean;
};

type NotifTemplate = {
  key: string;
  title: string;
  body: string;
  variables: string[] | null;
  is_active: boolean;
};

export default async function AdminTemplatesPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();

  const [emails, notifs] = await Promise.all([
    supabase.from("email_templates").select("*").order("key"),
    supabase.from("notification_templates").select("*").order("key"),
  ]);

  const emailRows = (emails.data as EmailTemplate[] | null) ?? [];
  const notifRows = (notifs.data as NotifTemplate[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Notifications"
        title="Templates"
        description="Email and in-app notification copy with {{variable}} placeholders that get filled in at send time."
      />

      <StatusNote saved={sp.saved} error={sp.error} />

      <section>
        <h2 className="mb-3 text-xl font-semibold">Email</h2>
        <div className="space-y-4">
          {emailRows.map((t) => (
            <Card key={t.key}>
              <CardHeader>
                <CardTitle className="font-mono text-base">{t.key}</CardTitle>
                {(t.variables ?? []).length > 0 && (
                  <CardDescription>
                    Variables: {(t.variables ?? []).map((v) => `{{${v}}}`).join(" ")}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <form action={updateEmailTemplate} className="space-y-4">
                  <input type="hidden" name="key" value={t.key} />
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input name="subject" defaultValue={t.subject} required />
                  </div>
                  <div className="space-y-2">
                    <Label>HTML body</Label>
                    <Textarea name="body_html" defaultValue={t.body_html} rows={6} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Plain-text body (optional fallback)</Label>
                    <Textarea name="body_text" defaultValue={t.body_text ?? ""} rows={3} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch name="is_active" defaultChecked={t.is_active} />
                    <Label>Active</Label>
                  </div>
                  <SubmitButton size="sm">Save</SubmitButton>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">In-app notification</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Shown in the back-office bell. Only the notification types the system
          actually sends are listed — one card per type, with when it fires.
        </p>
        <div className="space-y-4">
          {/* Driven by the code registry, not the raw table, so an admin never
              edits copy for a key nothing consumes — and a consumed key whose
              row is missing (migration 0017 not applied yet) is called out
              instead of silently disappearing. */}
          {Object.values(NOTIFICATION_TYPES).map((def) => {
            const t = notifRows.find((r) => r.key === def.key);
            return (
              <Card key={def.key}>
                <CardHeader>
                  <CardTitle className="font-mono text-base">{def.key}</CardTitle>
                  <CardDescription>
                    {def.description}
                    {def.variables.length > 0 && (
                      <> Variables: {def.variables.map((v) => `{{${v}}}`).join(" ")}</>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {t ? (
                    <form action={updateNotificationTemplate} className="space-y-4">
                      <input type="hidden" name="key" value={t.key} />
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input name="title" defaultValue={t.title} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Body</Label>
                        <Textarea name="body" defaultValue={t.body} rows={3} required />
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch name="is_active" defaultChecked={t.is_active} />
                        <Label>Active</Label>
                      </div>
                      <SubmitButton size="sm">Save</SubmitButton>
                    </form>
                  ) : (
                    <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                      Not editable yet — this template row hasn&apos;t been seeded in the
                      database (apply migration <code>0017_notification_templates.sql</code>).
                      Until then the built-in default copy is used:{" "}
                      <span className="font-medium">{def.defaultTitle}</span> —{" "}
                      {def.defaultBody}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
