import { redirect } from "next/navigation";
import { BarChart3, BedDouble, ClipboardList, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Metric } from "@/components/ui/metric";

const MANAGER_PLUS = new Set(["manager", "super_admin"]);

type AggBooking = {
  status: string;
  total_amount: number;
  room_id: string;
  rooms: { room_types: { id: string; name: string } } | null;
};

export default async function ReportsPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard/reports");
  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const role = (actor as { role: string } | null)?.role ?? "guest";
  if (!MANAGER_PLUS.has(role)) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Manager access required</CardTitle>
            <CardDescription>
              Reports are restricted to managers and super admins.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { data, count: bookingsCount } = await supabase
    .from("bookings")
    .select(
      "status, total_amount, room_id, rooms:room_id(room_types:type_id(id, name))",
      { count: "exact" },
    );
  const rows = (data as unknown as AggBooking[] | null) ?? [];

  const { count: totalRoomsCount } = await supabase
    .from("rooms")
    .select("*", { count: "exact", head: true });

  const byStatus: Record<string, number> = {};
  let revenue = 0;
  const byRoomType: Record<string, { name: string; count: number }> = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (["confirmed", "checked_in", "checked_out"].includes(r.status)) {
      revenue += Number(r.total_amount ?? 0);
    }
    const rtName = r.rooms?.room_types?.name ?? "Unknown";
    const rtId = r.rooms?.room_types?.id ?? "unknown";
    if (!byRoomType[rtId]) byRoomType[rtId] = { name: rtName, count: 0 };
    byRoomType[rtId].count += 1;
  }

  const total = bookingsCount ?? rows.length;
  const cancelled = byStatus["cancelled"] ?? 0;
  const cancellationRate = total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0;
  const active =
    (byStatus["confirmed"] ?? 0) +
    (byStatus["checked_in"] ?? 0) +
    (byStatus["checked_out"] ?? 0);

  const top = Object.values(byRoomType).sort((a, b) => b.count - a.count).slice(0, 5);

  const { count: occupiedNow } = await supabase
    .from("rooms")
    .select("*", { count: "exact", head: true })
    .eq("status", "occupied");
  const occupancyPct =
    totalRoomsCount && totalRoomsCount > 0
      ? Math.round(((occupiedNow ?? 0) / totalRoomsCount) * 1000) / 10
      : 0;

  const { data: settings } = await supabase
    .from("site_settings")
    .select("currency_symbol")
    .single();
  const symbol = (settings?.currency_symbol as string) ?? "Rs.";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow="At a glance"
        title="Reports"
        description="All-time snapshot. Date filters and charts come in a later iteration."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric
          label="Total bookings"
          value={total}
          icon={ClipboardList}
        />
        <Metric
          label="Confirmed + active"
          value={active}
          icon={CheckCircle2}
        />
        <Metric
          label="Revenue"
          value={`${symbol} ${revenue.toLocaleString()}`}
          icon={TrendingUp}
          tone="accent"
        />
        <Metric
          label="Cancellation rate"
          value={`${cancellationRate}%`}
          icon={XCircle}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy right now</CardTitle>
            <CardDescription>Rooms occupied / total rooms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <p className="font-display text-5xl font-semibold tracking-tight">
                {occupancyPct}%
              </p>
              <BedDouble className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {occupiedNow ?? 0} of {totalRoomsCount ?? 0}
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${Math.min(100, occupancyPct)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top room types</CardTitle>
            <CardDescription>By booking count</CardDescription>
          </CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ul className="space-y-3">
                {top.map((t, i) => {
                  const max = top[0].count;
                  const pct = max > 0 ? Math.round((t.count / max) * 100) : 0;
                  return (
                    <li key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{t.name}</span>
                        <span className="font-mono text-muted-foreground">{t.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status breakdown</CardTitle>
          <CardDescription>All bookings by lifecycle stage</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
            {[
              { key: "pending", label: "Pending" },
              { key: "confirmed", label: "Confirmed" },
              { key: "checked_in", label: "Checked in" },
              { key: "checked_out", label: "Checked out" },
              { key: "cancelled", label: "Cancelled" },
            ].map((s) => (
              <div
                key={s.key}
                className="rounded-md border border-border/60 bg-muted/30 p-3"
              >
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </dt>
                <dd className="mt-1 font-display text-2xl font-semibold">
                  {byStatus[s.key] ?? 0}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
