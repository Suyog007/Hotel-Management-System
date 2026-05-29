import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Badge,
  bookingStatusBadge,
  paymentStatusBadge,
  requestStatusBadge,
} from "@/components/ui/badge";
import { cancelBooking, requestService } from "./actions";

type ServiceOption = {
  id: string;
  name: string;
  category: string;
  price: number | null;
};

type RequestedService = {
  id: string;
  status: string;
  scheduled_at: string | null;
  notes: string | null;
  services: { name: string; category: string } | null;
};

type BookingDetail = {
  id: string;
  booking_code: string;
  access_token: string;
  guest_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  nights: number;
  subtotal: number;
  tax_amount: number;
  service_amount: number;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  special_requests: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  refund_amount_due: number | null;
  refunded_amount: number | null;
  refund_reference: string | null;
  rooms: { room_number: string; room_types: { name: string; slug: string } } | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOKING_SELECT =
  "id, booking_code, access_token, guest_id, guest_name, guest_email, guest_phone, check_in, check_out, guests_count, nights, subtotal, tax_amount, service_amount, total_amount, status, payment_status, payment_method, special_requests, cancelled_at, cancellation_reason, refund_amount_due, refunded_amount, refund_reference, rooms:room_id(room_number, room_types:type_id(name, slug))";

export default async function BookingDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    pay?: string;
    cancelled?: string;
    error?: string;
    service_requested?: string;
    t?: string;
  }>;
}) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();

  // Three access paths:
  //   1. Signed-in: RLS-respecting fetch (owner-self or staff). Falls back to
  //      admin client if RLS hides the row but the URL carries a valid token.
  //   2. Anonymous + valid ?t=<access_token>: admin client + token equality.
  //   3. No session, no token: bounce to login.
  let b: BookingDetail | null = null;
  let viewerMode: "owner" | "staff" | "token" | null = null;

  if (auth.user) {
    const { data: actor } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("auth_user_id", auth.user.id)
      .single();
    const a = actor as { id: string; role: string } | null;

    const { data } = await supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("id", id)
      .single();
    if (data) {
      b = data as unknown as BookingDetail;
      viewerMode =
        a && ["receptionist", "manager", "super_admin"].includes(a.role)
          ? "staff"
          : "owner";
    }
  }

  if (!b && sp.t && UUID_RE.test(sp.t)) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("id", id)
      .eq("access_token", sp.t)
      .single();
    if (data) {
      b = data as unknown as BookingDetail;
      viewerMode = "token";
    }
  }

  if (!b) {
    if (!auth.user) redirect(`/login?next=/booking/${id}`);
    notFound();
  }

  const cancellable = b.status === "pending" || b.status === "confirmed";
  const canRequestServices =
    (b.status === "confirmed" || b.status === "checked_in") &&
    viewerMode !== "token";

  // Token viewers can't go through RLS on service_requests — use admin for both.
  const reqClient = viewerMode === "token" ? createAdminClient() : supabase;
  const [servicesRes, requestsRes, settingsRes] = await Promise.all([
    canRequestServices
      ? supabase
          .from("services")
          .select("id, name, category, price")
          .eq("is_active", true)
          .order("category")
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    reqClient
      .from("service_requests")
      .select(
        "id, status, scheduled_at, notes, services:service_id(name, category)",
      )
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("site_settings").select("currency_symbol").single(),
  ]);
  const services = (servicesRes.data as ServiceOption[] | null) ?? [];
  const requests =
    (requestsRes.data as unknown as RequestedService[] | null) ?? [];
  const symbol = (settingsRes.data?.currency_symbol as string) ?? "Rs.";

  const status = bookingStatusBadge(b.status);
  const payment = paymentStatusBadge(b.payment_status);

  return (
    <>
      <SiteHeader />
      <main id="main" className="container max-w-4xl py-8 md:py-12">
        <Link
          href={viewerMode === "token" ? "/" : viewerMode === "staff" ? "/dashboard/bookings" : "/my-bookings"}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {viewerMode === "token" ? "Home" : viewerMode === "staff" ? "All bookings" : "My bookings"}
        </Link>

        {viewerMode === "token" && (
          <p className="mt-4 text-xs text-muted-foreground">
            Bookmark this page or keep the confirmation email — this is the only link to your booking.
          </p>
        )}

        {sp.pay === "pending" && b.payment_method === "online" && (
          <Banner tone="warning">
            Online payment is currently disabled. Your booking is reserved as <strong>pending</strong> until the front desk records payment.
          </Banner>
        )}
        {sp.cancelled && (
          <Banner tone="warning">
            Cancellation recorded.{" "}
            {b.refund_amount_due !== null && Number(b.refund_amount_due) > 0
              ? `A refund of ${symbol} ${Number(b.refund_amount_due).toLocaleString()} will be processed manually by the hotel.`
              : "No refund is due per the cancellation policy."}
          </Banner>
        )}
        {sp.error && <Banner tone="danger">{sp.error}</Banner>}
        {sp.service_requested && (
          <Banner tone="success">
            Service requested. Our team will reach out to confirm.
          </Banner>
        )}

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-border/60 bg-muted/30 px-6 py-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Booking
                </p>
                <p className="font-mono text-xl font-semibold">{b.booking_code}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={status.variant}>{status.label}</Badge>
                <Badge variant={payment.variant}>{payment.label}</Badge>
              </div>
            </div>
          </div>

          <CardContent className="space-y-8 p-6">
            {b.status === "cancelled" && (
              <section className="rounded-lg border border-danger/20 bg-danger/5 p-4">
                <h2 className="mb-3 text-sm font-semibold text-danger">Cancellation</h2>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {b.cancelled_at && (
                    <Row label="Cancelled at" value={b.cancelled_at.slice(0, 10)} />
                  )}
                  <Row
                    label="Refund due"
                    value={`${symbol} ${Number(b.refund_amount_due ?? 0).toLocaleString()}`}
                  />
                  {b.refunded_amount !== null && (
                    <Row
                      label="Refunded"
                      value={`${symbol} ${Number(b.refunded_amount).toLocaleString()}${b.refund_reference ? ` · ref ${b.refund_reference}` : ""}`}
                    />
                  )}
                  {b.cancellation_reason && (
                    <div className="col-span-2">
                      <dt className="text-xs uppercase text-muted-foreground">Reason</dt>
                      <dd className="whitespace-pre-line">{b.cancellation_reason}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">Stay</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <Row label="Room" value={`${b.rooms?.room_types.name ?? "—"} · #${b.rooms?.room_number ?? "—"}`} />
                <Row label="Check-in" value={b.check_in} />
                <Row label="Check-out" value={b.check_out} />
                <Row label="Nights" value={String(b.nights)} />
                <Row label="Guests" value={String(b.guests_count)} />
              </dl>
            </section>

            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">Guest</h2>
              <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                <Row label="Name" value={b.guest_name} />
                <Row label="Email" value={b.guest_email} />
                <Row label="Phone" value={b.guest_phone} />
              </dl>
              {b.special_requests && (
                <p className="mt-4 whitespace-pre-line rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                  <span className="font-medium">Note: </span>
                  {b.special_requests}
                </p>
              )}
            </section>

            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">Receipt</h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{symbol} {Number(b.subtotal).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Tax</dt>
                  <dd>{symbol} {Number(b.tax_amount).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Service</dt>
                  <dd>{symbol} {Number(b.service_amount).toLocaleString()}</dd>
                </div>
                <div className="mt-2 flex justify-between border-t border-border pt-2 font-display text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{symbol} {Number(b.total_amount).toLocaleString()}</dd>
                </div>
              </dl>
            </section>

            {(canRequestServices || requests.length > 0) && (
              <section>
                <h2 className="mb-3 font-display text-lg font-semibold">Services</h2>

                {requests.length > 0 && (
                  <ul className="mb-4 space-y-2 text-sm">
                    {requests.map((r) => {
                      const v = requestStatusBadge(r.status);
                      return (
                        <li
                          key={r.id}
                          className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
                        >
                          <span>
                            {r.services?.name ?? "—"}{" "}
                            <span className="text-xs text-muted-foreground">
                              ({r.services?.category})
                            </span>
                          </span>
                          <Badge variant={v.variant}>{v.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {canRequestServices && services.length > 0 && (
                  <form action={requestService} className="space-y-3 rounded-md border border-border bg-card p-4">
                    <input type="hidden" name="booking_id" value={b.id} />
                    <div className="space-y-2">
                      <Label>Pick a service</Label>
                      <select
                        name="service_id"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.category})
                            {s.price !== null && ` — ${symbol} ${Number(s.price).toLocaleString()}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="sched">Preferred time <span className="text-muted-foreground">(optional)</span></Label>
                        <Input id="sched" name="scheduled_at" type="datetime-local" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="req-notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
                        <Input id="req-notes" name="notes" />
                      </div>
                    </div>
                    <Button type="submit" size="sm">Request service</Button>
                  </form>
                )}
              </section>
            )}

            {cancellable && (
              <section className="border-t border-border pt-6">
                <h2 className="mb-2 text-sm font-semibold">Need to cancel?</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  Refund is computed from the cancellation policy and processed manually by the hotel.
                </p>
                <form action={cancelBooking} className="space-y-3">
                  <input type="hidden" name="id" value={b.id} />
                  {viewerMode === "token" && (
                    <input type="hidden" name="token" value={b.access_token} />
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="cancel-reason">Reason <span className="text-muted-foreground">(optional)</span></Label>
                    <Textarea id="cancel-reason" name="reason" rows={2} />
                  </div>
                  <Button type="submit" variant="destructive" size="sm">
                    Cancel booking
                  </Button>
                </form>
              </section>
            )}
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const styles =
    tone === "success"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "danger"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-warning/30 bg-warning/10 text-warning-foreground";
  return (
    <div className={`mt-4 rounded-md border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}
