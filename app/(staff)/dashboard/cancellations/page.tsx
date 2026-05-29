import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { XCircle, CheckCircle2 } from "lucide-react";
import { recordRefund } from "./actions";

type CancelledRow = {
  id: string;
  booking_code: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  paid_amount: number;
  total_amount: number;
  payment_method: string;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  refund_amount_due: number | null;
  refunded_amount: number | null;
  refund_reference: string | null;
  refunded_at: string | null;
};

export default async function CancellationsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const { data: actor } = auth.user
    ? await supabase.from("profiles").select("role").eq("auth_user_id", auth.user.id).single()
    : { data: null };
  const role = (actor as { role: string } | null)?.role ?? "guest";
  const isManagerPlus = role === "manager" || role === "super_admin";

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, guest_name, guest_email, check_in, check_out, paid_amount, total_amount, payment_method, cancellation_reason, cancelled_at, refund_amount_due, refunded_amount, refund_reference, refunded_at",
    )
    .eq("status", "cancelled")
    .order("cancelled_at", { ascending: false });
  const rows = (data as CancelledRow[] | null) ?? [];

  const { data: settings } = await supabase
    .from("site_settings")
    .select("currency_symbol")
    .single();
  const symbol = (settings?.currency_symbol as string) ?? "Rs.";

  const pending = rows.filter((r) => !r.refunded_at);
  const done = rows.filter((r) => !!r.refunded_at);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Settlement"
        title="Cancellations"
        description="Refunds are settled out-of-band (Khalti/eSewa dashboards or cash). Record the actual amount and reference once you've issued it."
        actions={
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="warning">{`${pending.length} pending`}</Badge>
            <Badge variant="outline">{`${done.length} refunded`}</Badge>
          </div>
        }
      />

      {sp.saved && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">Saved.</div>}
      {sp.error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{sp.error}</div>}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Pending refunds</h2>
        {pending.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing pending"
            description="All cancelled bookings have had their refunds recorded."
          />
        )}
        <div className="space-y-3">
          {pending.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="font-mono text-base">{r.booking_code}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {r.guest_name} · {r.guest_email}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Row label="Stay" value={`${r.check_in} → ${r.check_out}`} />
                  <Row label="Paid" value={`${symbol} ${Number(r.paid_amount ?? 0).toLocaleString()}`} />
                  <Row label="Refund due" value={`${symbol} ${Number(r.refund_amount_due ?? 0).toLocaleString()}`} />
                  <Row label="Method" value={r.payment_method.replace("_", " ")} />
                </dl>
                {r.cancellation_reason && (
                  <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium">Reason: </span>
                    {r.cancellation_reason}
                  </p>
                )}

                {isManagerPlus ? (
                  <form action={recordRefund} className="space-y-3 rounded-md border bg-background p-4">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={`amt-${r.id}`}>Refunded amount</Label>
                        <Input
                          id={`amt-${r.id}`}
                          name="refunded_amount"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={String(r.refund_amount_due ?? 0)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`ref-${r.id}`}>Provider reference</Label>
                        <Input
                          id={`ref-${r.id}`}
                          name="refund_reference"
                          placeholder="Khalti txn id / eSewa ref / cash receipt #"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`note-${r.id}`}>Internal notes (optional)</Label>
                      <Textarea id={`note-${r.id}`} name="notes" rows={2} />
                    </div>
                    <Button type="submit" size="sm">Mark refunded</Button>
                  </form>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    A manager will process this refund.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Refunded</h2>
          <div className="space-y-3">
            {done.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <div>
                      <p className="font-mono text-base">{r.booking_code}</p>
                      <p className="text-muted-foreground">
                        {r.guest_name} · {r.guest_email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {symbol} {Number(r.refunded_amount ?? 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ref {r.refund_reference} · {r.refunded_at?.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
