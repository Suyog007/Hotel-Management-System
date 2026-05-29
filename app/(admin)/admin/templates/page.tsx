import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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

      {sp.saved && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">Saved.</div>}
      {sp.error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{sp.error}</div>}

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
                  <Button type="submit">Save</Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">In-app notification</h2>
        <div className="space-y-4">
          {notifRows.map((t) => (
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
                  <Button type="submit">Save</Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
