import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, BedDouble, CalendarClock, Sparkles, XCircle } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusNote } from "@/components/ui/status-note";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Badge,
  bookingStatusBadge,
  paymentStatusBadge,
  roomStatusBadge,
} from "@/components/ui/badge";
import { CheckOutButton } from "@/components/staff/checkout-button";
import { checkIn, checkOut, extendStay, markRoomReady } from "../actions";
import { cancelBooking } from "@/app/booking/[id]/actions";

type Detail = {
  id: string;
  booking_code: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  guests_count: number;
  nights: number;
  subtotal: number;
  tax_amount: number;
  service_amount: number;
  total_amount: number;
  paid_amount: number | null;
  status: string;
  payment_status: string;
  payment_method: string;
  special_requests: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  refund_amount_due: number | null;
  refunded_amount: number | null;
  room_id: string;
  rooms: { room_number: string; status: string; room_types: { name: string } | null } | null;
};

const SELECT =
  "id, booking_code, guest_name, guest_email, guest_phone, check_in, check_out, guests_count, nights, subtotal, tax_amount, service_amount, total_amount, paid_amount, status, payment_status, payment_method, special_requests, cancelled_at, cancellation_reason, refund_amount_due, refunded_amount, room_id, rooms:room_id(room_number, status, room_types:type_id(name))";

const MANAGER_ROLES = new Set(["manager", "super_admin"]);
const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default async function StaffBookingDetail(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; extended?: string; nights?: string; collected?: string; cancelled?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);

  // /dashboard is staff-gated at the middleware + layout, so an admin client
  // read here is safe and sees every field regardless of RLS.
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: actor } = auth.user
    ? await supabase.from("profiles").select("role").eq("auth_user_id", auth.user.id).single()
    : { data: null };
  const role = (actor as { role?: string } | null)?.role ?? "";
  const isManager = MANAGER_ROLES.has(role);

  const admin = createAdminClient();
  const { data, error } = await admin.from("bookings").select(SELECT).eq("id", id).single();
  if (error || !data) notFound();
  const b = data as unknown as Detail;

  const s = bookingStatusBadge(b.status);
  const ps = paymentStatusBadge(b.payment_status);
  const symbol = "Rs.";
  const outstanding = Math.max(0, Number(b.total_amount) - Number(b.paid_amount ?? 0));
  const roomStatus = b.rooms?.status ?? "";
  const selfPath = `/dashboard/bookings/${b.id}`;

  const savedLabel =
    sp.cancelled
      ? "Booking cancelled."
      : sp.extended && sp.nights
        ? `Extended by ${sp.nights} night${sp.nights === "1" ? "" : "s"}.`
        : sp.collected
          ? `Checked out — collected ${symbol} ${Number(sp.collected).toLocaleString()}.`
          : "Done.";

  // Min new check-out for the extend picker: one day after the current one.
  const d = new Date(`${b.check_out}T00:00:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  const minExtend = d.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/bookings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> All bookings
      </Link>

      <PageHeader
        eyebrow="Booking"
        title={<span className="font-mono">{b.booking_code}</span>}
        description={`${b.guest_name} · ${b.rooms?.room_types?.name ?? "—"} · #${b.rooms?.room_number ?? "—"}`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={s.variant}>{s.label}</Badge>
            <Badge variant={ps.variant}>{ps.label}</Badge>
          </div>
        }
      />

      <StatusNote saved={sp.saved} error={sp.error} savedLabel={savedLabel} />

      {/* ── Actions ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Front desk actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            {(b.status === "pending" || b.status === "confirmed") && (
              <form action={checkIn}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="redirect_to" value={selfPath} />
                <SubmitButton size="sm" pendingLabel="Checking in…">
                  <BedDouble className="h-4 w-4" /> Check in
                </SubmitButton>
              </form>
            )}

            {b.status === "checked_in" && (
              <CheckOutButton
                bookingId={b.id}
                action={checkOut}
                outstanding={b.payment_status !== "paid" ? outstanding : 0}
                symbol={symbol}
                redirectTo={selfPath}
              />
            )}

            {b.status === "checked_out" && roomStatus === "cleaning" && (
              <form action={markRoomReady}>
                <input type="hidden" name="room_id" value={b.room_id} />
                <input type="hidden" name="redirect_to" value={selfPath} />
                <SubmitButton size="sm" variant="outline" pendingLabel="Updating…">
                  <Sparkles className="h-4 w-4" /> Mark #{b.rooms?.room_number} ready
                </SubmitButton>
              </form>
            )}

            {b.status === "checked_out" && roomStatus !== "cleaning" && (
              <p className="text-sm text-muted-foreground">
                Checked out. Room #{b.rooms?.room_number} is{" "}
                <Badge variant={roomStatusBadge(roomStatus).variant}>
                  {roomStatusBadge(roomStatus).label}
                </Badge>
                .
              </p>
            )}

            {b.status === "cancelled" && (
              <p className="text-sm text-muted-foreground">
                This booking was cancelled{b.cancelled_at ? ` on ${fmtDate(b.cancelled_at.slice(0, 10))}` : ""}.
              </p>
            )}
          </div>

          {/* Extend stay — manager+, active stays only */}
          {(b.status === "confirmed" || b.status === "checked_in") && isManager && (
            <div className="border-t border-border/60 pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <CalendarClock className="h-4 w-4 text-muted-foreground" /> Extend stay
              </p>
              <form action={extendStay} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="redirect_to" value={selfPath} />
                <div className="space-y-1.5">
                  <Label className="text-xs">New check-out</Label>
                  <Input type="date" name="new_check_out" min={minExtend} defaultValue={minExtend} required className="h-9" />
                </div>
                <SubmitButton size="sm" variant="outline" pendingLabel="Extending…">
                  Extend &amp; recalc total
                </SubmitButton>
              </form>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Extra nights are charged at the room&apos;s current nightly rate.
              </p>
            </div>
          )}

          {/* Cancel — pending/confirmed only (a checked-in guest can't be cancelled) */}
          {(b.status === "pending" || b.status === "confirmed") && (
            <div className="border-t border-border/60 pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
                <XCircle className="h-4 w-4" /> Cancel booking
              </p>
              <form action={cancelBooking} className="space-y-2">
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="redirect_to" value={selfPath} />
                <Textarea
                  name="reason"
                  rows={2}
                  placeholder="Reason (optional) — recorded on the booking"
                  className="text-sm"
                />
                <SubmitButton
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  confirmMessage="Cancel this booking? The guest is emailed and the recommended refund is computed. This can't be undone."
                  pendingLabel="Cancelling…"
                >
                  Cancel booking
                </SubmitButton>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Stay ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stay</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Field label="Room">
            {b.rooms?.room_types?.name ?? "—"}
            <span className="block text-xs text-muted-foreground">#{b.rooms?.room_number ?? "—"}</span>
          </Field>
          <Field label="Check-in">{fmtDate(b.check_in)}</Field>
          <Field label="Check-out">{fmtDate(b.check_out)}</Field>
          <Field label="Nights / guests">
            {b.nights} · {b.guests_count} {b.guests_count === 1 ? "guest" : "guests"}
          </Field>
          {b.special_requests && (
            <div className="col-span-2 sm:col-span-4">
              <Field label="Special requests">{b.special_requests}</Field>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Guest ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guest</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Field label="Name">{b.guest_name}</Field>
          <Field label="Phone">{b.guest_phone ?? "—"}</Field>
          <Field label="Email">
            <span className="break-all">
              {b.guest_email?.endsWith("@example.invalid") ? "— (walk-in)" : b.guest_email}
            </span>
          </Field>
        </CardContent>
      </Card>

      {/* ── Receipt ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <Row label="Subtotal" value={`${symbol} ${Number(b.subtotal).toLocaleString()}`} />
          {Number(b.tax_amount) > 0 && (
            <Row label="Tax" value={`${symbol} ${Number(b.tax_amount).toLocaleString()}`} />
          )}
          {Number(b.service_amount) > 0 && (
            <Row label="Service" value={`${symbol} ${Number(b.service_amount).toLocaleString()}`} />
          )}
          <div className="border-t border-border/60 pt-1.5">
            <Row label="Total" value={`${symbol} ${Number(b.total_amount).toLocaleString()}`} bold />
          </div>
          <Row label="Paid" value={`${symbol} ${Number(b.paid_amount ?? 0).toLocaleString()}`} />
          {outstanding > 0 && b.status !== "cancelled" && (
            <Row
              label="Outstanding"
              value={`${symbol} ${outstanding.toLocaleString()}`}
              tone="danger"
            />
          )}
          {b.status === "cancelled" && b.refund_amount_due != null && (
            <Row
              label="Recommended refund"
              value={`${symbol} ${Number(b.refund_amount_due).toLocaleString()}`}
            />
          )}
        </CardContent>
      </Card>

      {b.status === "cancelled" && (
        <p className="text-center text-xs text-muted-foreground">
          Refunds are recorded from the{" "}
          <Link href="/dashboard/cancellations" className="underline">
            Cancellations
          </Link>{" "}
          page.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{children}</p>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "danger";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={tone === "danger" ? "text-destructive" : "text-muted-foreground"}>{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${tone === "danger" ? "font-medium text-destructive" : ""}`}>
        {value}
      </span>
    </div>
  );
}
