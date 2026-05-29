import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarPlus, CalendarMinus, BedDouble } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";

const ACTIVE_STATUSES = ["pending", "confirmed", "checked_in"];

type BookingSpan = {
  id: string;
  booking_code: string;
  guest_name: string;
  check_in: string; // YYYY-MM-DD
  check_out: string;
  status: string;
  rooms: { room_number: string; room_types: { name: string } } | null;
};

function parseMonth(input: string | undefined): { year: number; month: number } {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const [y, m] = input.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths({ year, month }: { year: number; month: number }, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function monthLabel({ year, month }: { year: number; month: number }) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function CalendarPage(props: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await props.searchParams;
  const cursor = parseMonth(sp.m);
  const monthStart = new Date(Date.UTC(cursor.year, cursor.month - 1, 1));
  const monthEnd = new Date(Date.UTC(cursor.year, cursor.month, 0)); // last day
  const daysInMonth = monthEnd.getUTCDate();
  const todayStr = ymd(new Date());

  const supabase = await createServerClient();
  // Bookings whose stay overlaps any day in this month.
  // daterange semantics: stay is [check_in, check_out). A stay overlaps the
  // month if check_in <= monthEnd AND check_out > monthStart.
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, guest_name, check_in, check_out, status, rooms:room_id(room_number, room_types:type_id(name))",
    )
    .in("status", ACTIVE_STATUSES)
    .lte("check_in", ymd(monthEnd))
    .gt("check_out", ymd(monthStart))
    .order("check_in");

  const bookings = (data as unknown as BookingSpan[] | null) ?? [];

  // Build per-day buckets.
  const days: {
    iso: string;
    day: number;
    arrivals: BookingSpan[];
    departures: BookingSpan[];
    occupied: BookingSpan[];
  }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(cursor.year, cursor.month - 1, d));
    const iso = ymd(dt);
    days.push({
      iso,
      day: d,
      arrivals: bookings.filter((b) => b.check_in === iso),
      departures: bookings.filter((b) => b.check_out === iso),
      // Occupied = stay covers this day, i.e. check_in <= iso < check_out
      occupied: bookings.filter((b) => b.check_in <= iso && b.check_out > iso),
    });
  }

  // Pad with leading empty cells for the calendar grid (Sunday start).
  const leadingBlanks = monthStart.getUTCDay(); // 0=Sun ... 6=Sat
  const prev = addMonths(cursor, -1);
  const next = addMonths(cursor, +1);
  const monthBookingsCount = bookings.length;
  const monthArrivalsCount = bookings.filter((b) => b.check_in >= ymd(monthStart) && b.check_in <= ymd(monthEnd)).length;
  const monthDeparturesCount = bookings.filter((b) => b.check_out >= ymd(monthStart) && b.check_out <= ymd(monthEnd)).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Schedule"
        title="Booking calendar"
        description="Arrivals, departures, and current occupancy across the month."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/bookings/calendar?m=${prev.year}-${String(prev.month).padStart(2, "0")}`}
            aria-label="Previous month"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-card transition-colors hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <p className="flex-1 truncate font-display text-xl font-semibold sm:flex-initial sm:text-2xl">
            {monthLabel(cursor)}
          </p>
          <Link
            href={`/dashboard/bookings/calendar?m=${next.year}-${String(next.month).padStart(2, "0")}`}
            aria-label="Next month"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-card transition-colors hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/bookings/calendar"
            className="ml-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Today
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5 text-success" />
            {monthArrivalsCount} arrivals
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarMinus className="h-3.5 w-3.5 text-warning" />
            {monthDeparturesCount} departures
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="h-3.5 w-3.5 text-accent" />
            {monthBookingsCount} active
          </span>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[11px]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="pb-1">
            <span className="sm:hidden">{d.charAt(0)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} className="min-h-[64px] rounded-md bg-muted/30 sm:min-h-[112px]" />
        ))}
        {days.map((d) => {
          const isToday = d.iso === todayStr;
          return (
            <div
              key={d.iso}
              className={`min-h-[64px] rounded-md border bg-card p-1 transition-colors sm:min-h-[112px] sm:p-2 ${
                isToday ? "border-accent/60 bg-accent/5" : "border-border/60"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-1 sm:mb-2">
                <span
                  className={`text-xs font-medium sm:text-sm ${
                    isToday ? "text-accent" : "text-foreground"
                  }`}
                >
                  {d.day}
                </span>
                {d.occupied.length > 0 && (
                  <span className="hidden rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                    {d.occupied.length} in-house
                  </span>
                )}
                {d.occupied.length > 0 && (
                  <span className="rounded-full bg-foreground/5 px-1 py-0 text-[9px] font-medium text-muted-foreground sm:hidden">
                    {d.occupied.length}
                  </span>
                )}
              </div>

              {/* On mobile (<sm), just show dot-count chips. On sm+, show
                  the full name list. Keeps narrow cells readable. */}
              <div className="flex flex-col gap-0.5 sm:hidden">
                {d.arrivals.length > 0 && (
                  <span className="rounded bg-success/10 px-1 py-0 text-center text-[10px] font-medium text-success">
                    +{d.arrivals.length}
                  </span>
                )}
                {d.departures.length > 0 && (
                  <span className="rounded bg-warning/10 px-1 py-0 text-center text-[10px] font-medium text-warning-foreground">
                    −{d.departures.length}
                  </span>
                )}
              </div>
              <ul className="hidden space-y-1 sm:block">
                {d.arrivals.slice(0, 3).map((b) => (
                  <li
                    key={`a-${b.id}`}
                    title={`${b.guest_name} → ${b.rooms?.room_types?.name ?? "Room"} #${b.rooms?.room_number ?? "—"}`}
                    className="flex items-center gap-1 truncate rounded bg-success/10 px-1.5 py-0.5 text-[11px] text-success"
                  >
                    <CalendarPlus className="h-3 w-3 shrink-0" />
                    <span className="truncate">{b.guest_name}</span>
                  </li>
                ))}
                {d.departures.slice(0, 3).map((b) => (
                  <li
                    key={`d-${b.id}`}
                    title={`${b.guest_name} ← ${b.rooms?.room_types?.name ?? "Room"} #${b.rooms?.room_number ?? "—"}`}
                    className="flex items-center gap-1 truncate rounded bg-warning/10 px-1.5 py-0.5 text-[11px] text-warning-foreground"
                  >
                    <CalendarMinus className="h-3 w-3 shrink-0" />
                    <span className="truncate">{b.guest_name}</span>
                  </li>
                ))}
                {(d.arrivals.length + d.departures.length) > 6 && (
                  <li className="text-[10px] text-muted-foreground">
                    +{d.arrivals.length + d.departures.length - 6} more
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-4 text-xs text-muted-foreground">
        <p>
          <strong>Active bookings</strong> include statuses{" "}
          <code>pending</code>, <code>confirmed</code>, and{" "}
          <code>checked_in</code>. Cancelled or already checked-out bookings
          are hidden. To check guests in or out, head to{" "}
          <Link href="/dashboard/bookings" className="underline hover:text-foreground">
            Bookings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
