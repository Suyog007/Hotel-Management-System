import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusNote } from "@/components/ui/status-note";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import { FormActions } from "@/components/ui/form-actions";
import { ManageList, type ManageListItem } from "@/components/ui/manage-list";
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

const EMAIL_GROUP = "Email";
const NOTIF_GROUP = "In-app notification";

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

  const emailItems: ManageListItem[] = emailRows.map((t) => ({
    id: `email:${t.key}`,
    title: t.key,
    subtitle: t.subject,
    group: EMAIL_GROUP,
    badge: t.is_active ? null : { label: "Off", variant: "outline" as const },
    search: `${t.body_html} ${t.body_text ?? ""} ${(t.variables ?? []).join(" ")}`,
    children: (
      <form action={updateEmailTemplate} className="space-y-4">
        <input type="hidden" name="key" value={t.key} />
        <VariableHint variables={t.variables ?? []} />
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
        <FormActions>
          <SubmitButton size="sm">Save</SubmitButton>
        </FormActions>
      </form>
    ),
  }));

  // Driven by the code registry, not the raw table, so an admin never edits copy
  // for a key nothing consumes — and a consumed key whose row is missing
  // (migration 0017 not applied yet) is called out instead of silently
  // disappearing.
  const notifItems: ManageListItem[] = Object.values(NOTIFICATION_TYPES).map((def) => {
    const t = notifRows.find((r) => r.key === def.key);
    return {
      id: `notif:${def.key}`,
      title: def.key,
      subtitle: def.description,
      group: NOTIF_GROUP,
      badge: !t
        ? { label: "Not seeded", variant: "warning" as const }
        : t.is_active
          ? null
          : { label: "Off", variant: "outline" as const },
      search: `${t?.title ?? def.defaultTitle} ${t?.body ?? def.defaultBody} ${def.variables.join(" ")}`,
      children: t ? (
        <form action={updateNotificationTemplate} className="space-y-4">
          <input type="hidden" name="key" value={t.key} />
          <VariableHint variables={def.variables} />
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
          <FormActions>
            <SubmitButton size="sm">Save</SubmitButton>
          </FormActions>
        </form>
      ) : (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          Not editable yet — this template row hasn&apos;t been seeded in the
          database (apply migration <code>0017_notification_templates.sql</code>).
          Until then the built-in default copy is used:{" "}
          <span className="font-medium">{def.defaultTitle}</span> — {def.defaultBody}
        </p>
      ),
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="Templates"
        description="Email and in-app notification copy with {{variable}} placeholders that get filled in at send time. Open a template to edit it."
      />

      <StatusNote saved={sp.saved} error={sp.error} />

      <ManageList
        storageKey="templates"
        noun="templates"
        searchPlaceholder="Search templates by key, subject or copy…"
        groupAllLabel="All channels"
        emptyLabel="No templates yet."
        items={[...emailItems, ...notifItems]}
      />
    </div>
  );
}

/** The {{placeholders}} this template may use, above the fields that take them. */
function VariableHint({ variables }: { variables: string[] }) {
  if (variables.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>Variables:</span>
      {variables.map((v) => (
        <code key={v} className="rounded bg-muted px-1.5 py-0.5 font-mono">
          {`{{${v}}}`}
        </code>
      ))}
    </p>
  );
}
