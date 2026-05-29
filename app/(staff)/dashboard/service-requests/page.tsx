import Link from "next/link";
import { ConciergeBell, CheckCheck } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, requestStatusBadge } from "@/components/ui/badge";
import { updateServiceRequestStatus } from "./actions";

type RequestRow = {
  id: string;
  scheduled_at: string | null;
  notes: string | null;
  status: "requested" | "scheduled" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  bookings: { id: string; booking_code: string; guest_name: string; guest_phone: string; check_in: string; check_out: string } | null;
  services: { name: string; category: string } | null;
};

const NEXT_STATUS_BUTTONS: Record<string, { label: string; status: RequestRow["status"]; variant?: "default" | "outline" | "destructive" }[]> = {
  requested: [
    { label: "Schedule", status: "scheduled" },
    { label: "Start", status: "in_progress" },
    { label: "Cancel", status: "cancelled", variant: "destructive" },
  ],
  scheduled: [
    { label: "Start", status: "in_progress" },
    { label: "Cancel", status: "cancelled", variant: "destructive" },
  ],
  in_progress: [
    { label: "Complete", status: "completed" },
    { label: "Cancel", status: "cancelled", variant: "destructive" },
  ],
};

export default async function ServiceRequestsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("service_requests")
    .select(
      "id, scheduled_at, notes, status, created_at, bookings:booking_id(id, booking_code, guest_name, guest_phone, check_in, check_out), services:service_id(name, category)",
    )
    .order("created_at", { ascending: false });
  const rows = (data as unknown as RequestRow[] | null) ?? [];

  const active = rows.filter((r) => r.status !== "completed" && r.status !== "cancelled");
  const done = rows.filter((r) => r.status === "completed" || r.status === "cancelled");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Concierge"
        title="Service requests"
        description="Guests request these from their booking page. Handle them in order — schedule, start, complete."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="warning">{`${active.length} active`}</Badge>
            <Badge variant="outline">{`${done.length} closed`}</Badge>
          </div>
        }
      />

      {sp.saved && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">Saved.</div>}
      {sp.error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{sp.error}</div>}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Active ({active.length})</h2>
        {active.length === 0 && (
          <EmptyState
            icon={CheckCheck}
            title="Nothing to handle"
            description="All caught up. Sit back."
          />
        )}
        <div className="space-y-3">
          {active.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
        </div>
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Finished</h2>
          <div className="space-y-2">
            {done.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                  <div>
                    <span className="font-medium">{r.services?.name ?? "—"}</span>{" "}
                    · <Link href={`/booking/${r.bookings?.id}`} className="underline">{r.bookings?.booking_code}</Link>
                  </div>
                  <span className="text-xs uppercase text-muted-foreground">{r.status}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RequestCard({ r }: { r: RequestRow }) {
  const buttons = NEXT_STATUS_BUTTONS[r.status] ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {r.services?.name ?? "—"}{" "}
          <span className="text-xs font-normal text-muted-foreground">({r.services?.category})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
          <div>
            <Link href={`/booking/${r.bookings?.id}`} className="font-mono text-xs underline">
              {r.bookings?.booking_code}
            </Link>
            <p className="font-medium">{r.bookings?.guest_name}</p>
            <p className="text-xs text-muted-foreground">
              {r.bookings?.guest_phone} · {r.bookings?.check_in} → {r.bookings?.check_out}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-muted-foreground">{r.status}</p>
            {r.scheduled_at && (
              <p className="text-xs">scheduled {r.scheduled_at.slice(0, 16).replace("T", " ")}</p>
            )}
          </div>
        </div>
        {r.notes && (
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{r.notes}</p>
        )}
        {buttons.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {buttons.map((b) => (
              <form key={b.status} action={updateServiceRequestStatus}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="status" value={b.status} />
                <Button type="submit" size="sm" variant={b.variant ?? "default"}>{b.label}</Button>
              </form>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
