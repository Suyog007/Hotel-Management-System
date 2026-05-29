import Link from "next/link";
import {
  CalendarPlus,
  CalendarCheck,
  CalendarMinus,
  XCircle,
  ConciergeBell,
  MessageCircle,
  BedDouble,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Metric } from "@/components/ui/metric";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Badge,
  bookingStatusBadge,
  paymentStatusBadge,
} from "@/components/ui/badge";

type ArrivalRow = {
  id: string;
  booking_code: string;
  guest_name: string;
  check_in: string;
  status: string;
  payment_status: string;
  rooms: { room_number: string; room_types: { name: string } } | null;
};

export default async function DashboardHome() {
  const supabase = await createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [arrivalsRes, departuresRes, occupiedRes, totalRoomsRes, openChatsRes, pendingRefundsRes, todayArrivalsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("check_in", today)
      .in("status", ["pending", "confirmed"]),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("check_out", today)
      .eq("status", "checked_in"),
    supabase
      .from("rooms")
      .select("*", { count: "exact", head: true })
      .eq("status", "occupied"),
    supabase.from("rooms").select("*", { count: "exact", head: true }),
    supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .gt("staff_unread_count", 0),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "cancelled")
      .is("refunded_at", null),
    supabase
      .from("bookings")
      .select(
        "id, booking_code, guest_name, check_in, status, payment_status, rooms:room_id(room_number, room_types:type_id(name))",
      )
      .eq("check_in", today)
      .in("status", ["pending", "confirmed"])
      .order("check_in")
      .limit(5),
  ]);

  const arrivals = arrivalsRes.count ?? 0;
  const departures = departuresRes.count ?? 0;
  const occupied = occupiedRes.count ?? 0;
  const totalRooms = totalRoomsRes.count ?? 0;
  const openChats = openChatsRes.count ?? 0;
  const pendingRefunds = pendingRefundsRes.count ?? 0;
  const todayArrivals = (todayArrivalsRes.data as unknown as ArrivalRow[] | null) ?? [];

  const occupancy =
    totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long" })}
        title="Today at the front desk"
        description={`${today} · A snapshot of arrivals, departures, and pending work.`}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Metric
          label="Arrivals"
          value={arrivals}
          hint="today"
          icon={CalendarPlus}
          href="/dashboard/bookings"
          tone={arrivals > 0 ? "accent" : "default"}
        />
        <Metric
          label="Departures"
          value={departures}
          hint="today"
          icon={CalendarMinus}
          href="/dashboard/bookings"
        />
        <Metric
          label="Occupancy"
          value={`${occupancy}%`}
          hint={`${occupied} / ${totalRooms}`}
          icon={BedDouble}
        />
        <Metric
          label="Open chats"
          value={openChats}
          hint="unread"
          icon={MessageCircle}
          href="/dashboard/chat"
          tone={openChats > 0 ? "accent" : "default"}
        />
        <Metric
          label="Pending refunds"
          value={pendingRefunds}
          icon={XCircle}
          href="/dashboard/cancellations"
        />
        <Metric
          label="Service requests"
          value="—"
          hint="see all"
          icon={ConciergeBell}
          href="/dashboard/service-requests"
        />
      </div>

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Arriving today
          </h2>
          <Link
            href="/dashboard/bookings"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            All bookings
          </Link>
        </div>
        {todayArrivals.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                Nothing scheduled for today
              </CardTitle>
              <CardDescription>
                When guests are due to arrive, they&apos;ll show up here with quick check-in actions.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-2">
            {todayArrivals.map((b) => {
              const s = bookingStatusBadge(b.status);
              const ps = paymentStatusBadge(b.payment_status);
              return (
                <Link
                  key={b.id}
                  href={`/booking/${b.id}`}
                  className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
                >
                  <CalendarCheck className="h-5 w-5 text-accent" />
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-mono text-xs text-muted-foreground">{b.booking_code}</p>
                    <p className="font-medium">
                      {b.guest_name}
                      <span className="ml-2 text-muted-foreground">
                        · {b.rooms?.room_types.name ?? "—"} #{b.rooms?.room_number ?? "—"}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={s.variant}>{s.label}</Badge>
                    <Badge variant={ps.variant}>{ps.label}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
