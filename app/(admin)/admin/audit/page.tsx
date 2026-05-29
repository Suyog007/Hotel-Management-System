import { createServerClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollText } from "lucide-react";

type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: unknown;
  new_values: unknown;
  created_at: string;
};

const PAGE_SIZE = 50;

export default async function AuditLogPage(props: {
  searchParams: Promise<{
    action?: string;
    entity_type?: string;
    actor?: string;
    since?: string;
    until?: string;
    page?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createServerClient();
  let q = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (sp.action) q = q.eq("action", sp.action);
  if (sp.entity_type) q = q.eq("entity_type", sp.entity_type);
  if (sp.actor) q = q.ilike("actor_email", `%${sp.actor}%`);
  if (sp.since) q = q.gte("created_at", sp.since);
  if (sp.until) q = q.lte("created_at", sp.until);

  const { data, count } = await q;
  const rows = (data as AuditRow[] | null) ?? [];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        description="Every super-admin mutation and booking lifecycle event lands here. Click a row to see the before/after diff."
      />

      <Card>
        <CardContent className="pt-6">
          <form className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="action">Action</Label>
              <Input id="action" name="action" defaultValue={sp.action ?? ""} placeholder="create / update / delete" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="entity_type">Entity</Label>
              <Input id="entity_type" name="entity_type" defaultValue={sp.entity_type ?? ""} placeholder="bookings / faqs / …" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="actor">Actor email</Label>
              <Input id="actor" name="actor" defaultValue={sp.actor ?? ""} placeholder="contains…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="since">Since</Label>
              <Input id="since" name="since" type="date" defaultValue={sp.since ?? ""} />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm">Filter</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.length === 0 && (
          <EmptyState
            icon={ScrollText}
            title="No entries match"
            description="Try clearing the filters above, or wait for new activity."
          />
        )}
        {rows.map((r) => (
          <details key={r.id} className="rounded-md border bg-card open:bg-muted/20">
            <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-3 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs uppercase">
                  {r.action}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{r.entity_type}</span>
                {r.entity_id && (
                  <span className="font-mono text-xs text-muted-foreground">#{r.entity_id.slice(0, 8)}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {r.actor_email ?? "—"} · {r.created_at.replace("T", " ").slice(0, 19)}
              </div>
            </summary>
            <div className="grid grid-cols-1 gap-3 border-t bg-background p-4 text-xs md:grid-cols-2">
              <div>
                <p className="mb-1 font-semibold text-muted-foreground">Old</p>
                <pre className="overflow-x-auto rounded-md bg-muted p-2">
                  {r.old_values ? JSON.stringify(r.old_values, null, 2) : "—"}
                </pre>
              </div>
              <div>
                <p className="mb-1 font-semibold text-muted-foreground">New</p>
                <pre className="overflow-x-auto rounded-md bg-muted p-2">
                  {r.new_values ? JSON.stringify(r.new_values, null, 2) : "—"}
                </pre>
              </div>
            </div>
          </details>
        ))}
      </div>

      {pages > 1 && (
        <Pager page={page} pages={pages} sp={sp} />
      )}
    </div>
  );
}

function Pager({
  page,
  pages,
  sp,
}: {
  page: number;
  pages: number;
  sp: Record<string, string | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "page") params.set(k, v);
  }
  const prev = page > 1 ? `?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page - 1) })}` : null;
  const next = page < pages ? `?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page + 1) })}` : null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span>Page {page} of {pages}</span>
      <div className="flex gap-2">
        {prev && <a href={prev} className="rounded-md border px-3 py-1.5 hover:bg-muted">← Prev</a>}
        {next && <a href={next} className="rounded-md border px-3 py-1.5 hover:bg-muted">Next →</a>}
      </div>
    </div>
  );
}
