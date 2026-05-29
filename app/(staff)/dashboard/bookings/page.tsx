import Link from "next/link";
import { ClipboardList, CalendarPlus, CalendarMinus, Sparkles, Calendar } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import {
  Badge,
  bookingStatusBadge,
  paymentStatusBadge,
} from "@/components/ui/badge";
import { checkIn, checkOut, markRoomReady } from "./actions";

type BookingRow = {
  id: string;
  booking_code: string;
  guest_name: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  rooms: { id: string; room_number: string; status: string; room_types: { name: string } } | null;
};

export default async function DashboardBookingsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const selectClause = `
    id, booking_code, guest_name, guest_phone, check_in, check_out,
    status, payment_status, payment_method, total_amount,
    rooms:room_id(id, room_number, status, room_types:type_id(name))
  `;

  const [arrivalsRes, departuresRes, recentRes, cleaningRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(selectClause)
      .eq("check_in", today)
      .in("status", ["pending", "confirmed"])
      .order("check_in"),
    supabase
      .from("bookings")
      .select(selectClause)
      .eq("check_out", today)
      .eq("status", "checked_in")
      .order("check_out"),
    supabase
      .from("bookings")
      .select(selectClause)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("rooms")
      .select("id, room_number, status")
      .eq("status", "cleaning")
      .order("room_number"),
  ]);

  const arrivals = (arrivalsRes.data as unknown as BookingRow[] | null) ?? [];
  const departures = (departuresRes.data as unknown as BookingRow[] | null) ?? [];
  const recent = (recentRes.data as unknown as BookingRow[] | null) ?? [];
  const cleaning = (cleaningRes.data as { id: string; room_number: string }[] | null) ?? [];

  const { data: settings } = await supabase
    .from("site_settings")
    .select("currency_symbol")
    .single();
  const symbol = (settings?.currency_symbol as string) ?? "Rs.";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={`Today · ${today}`}
        title="Bookings"
        description="Today's arrivals and departures up top. Recent bookings below."
        actions={
          <Link
            href="/dashboard/bookings/calendar"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Calendar className="h-4 w-4" />
            Month view
          </Link>
        }
      />

      {sp.saved && (
        <div className="rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm">
          Saved.
        </div>
      )}
      {sp.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {sp.error}
        </div>
      )}

      <section>
        <SectionHead
          icon={CalendarPlus}
          title="Arrivals today"
          count={arrivals.length}
          tone="accent"
        />
        {arrivals.length === 0 ? (
          <EmptyState
            title="No arrivals today"
            description="Nothing on the schedule. Enjoy the quiet."
          />
        ) : (
          <div className="space-y-2">
            {arrivals.map((b) => (
              <BookingItem key={b.id} b={b} symbol={symbol} action="checkin" />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHead
          icon={CalendarMinus}
          title="Departures today"
          count={departures.length}
        />
        {departures.length === 0 ? (
          <EmptyState title="No departures today" />
        ) : (
          <div className="space-y-2">
            {departures.map((b) => (
              <BookingItem key={b.id} b={b} symbol={symbol} action="checkout" />
            ))}
          </div>
        )}
      </section>

      {cleaning.length > 0 && (
        <section>
          <SectionHead icon={Sparkles} title="Rooms in cleaning" count={cleaning.length} />
          <div className="flex flex-wrap gap-2">
            {cleaning.map((r) => (
              <form key={r.id} action={markRoomReady} className="inline">
                <input type="hidden" name="room_id" value={r.id} />
                <Button type="submit" variant="outline" size="sm">
                  Mark #{r.room_number} ready
                </Button>
              </form>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHead icon={ClipboardList} title="Recent bookings" count={recent.length} />
        {recent.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No bookings yet"
            description="Bookings will appear here as guests reserve rooms."
          />
        ) : (
          <div className="space-y-2">
            {recent.map((b) => (
              <BookingItem
                key={b.id}
                b={b}
                symbol={symbol}
                action={inferAction(b.status)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHead({
  icon: Icon,
  title,
  count,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  tone?: "default" | "accent";
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className={`grid h-8 w-8 place-items-center rounded-md ${tone === "accent" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <Badge variant="outline">{count}</Badge>
    </div>
  );
}

function inferAction(status: string): "checkin" | "checkout" | "none" {
  if (status === "pending" || status === "confirmed") return "checkin";
  if (status === "checked_in") return "checkout";
  return "none";
}

function BookingItem({
  b,
  symbol,
  action,
}: {
  b: BookingRow;
  symbol: string;
  action: "checkin" | "checkout" | "none";
}) {
  const s = bookingStatusBadge(b.status);
  const ps = paymentStatusBadge(b.payment_status);
  return (
    <Card className="transition-all hover:-translate-y-0.5 hover:shadow-soft-lg">
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <Avatar name={b.guest_name} size={40} />
        <div className="flex-1 min-w-[200px]">
          <Link href={`/booking/${b.id}`} className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline">
            {b.booking_code}
          </Link>
          <p className="font-medium">{b.guest_name}</p>
          <p className="text-xs text-muted-foreground">{b.guest_phone}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium">
            {b.rooms?.room_types.name ?? "—"} · #{b.rooms?.room_number ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">{b.check_in} → {b.check_out}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={s.variant}>{s.label}</Badge>
          <Badge variant={ps.variant}>{ps.label}</Badge>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{symbol} {Number(b.total_amount).toLocaleString()}</p>
        </div>
        {action === "checkin" && (
          <form action={checkIn}>
            <input type="hidden" name="id" value={b.id} />
            <Button type="submit" size="sm">Check in</Button>
          </form>
        )}
        {action === "checkout" && (
          <form action={checkOut}>
            <input type="hidden" name="id" value={b.id} />
            <Button type="submit" size="sm" variant="accent">Check out</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
