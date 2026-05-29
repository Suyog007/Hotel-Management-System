import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createWalkInBooking } from "./actions";

type RoomTypeOpt = { id: string; name: string; base_price: number; max_guests: number };

export default async function WalkInPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("room_types")
    .select("id, name, base_price, max_guests")
    .eq("is_active", true)
    .order("sort_order");
  const types = (data as RoomTypeOpt[] | null) ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Front desk"
        title="Walk-in booking"
        description="Create a booking on behalf of a guest at the desk or on the phone. A stub profile is created if no email is given."
      />

      {sp.error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{sp.error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>New walk-in</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createWalkInBooking} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Check-in</Label>
                <Input name="check_in" type="date" min={today} defaultValue={today} required />
              </div>
              <div className="space-y-2">
                <Label>Check-out</Label>
                <Input name="check_out" type="date" min={tomorrow} defaultValue={tomorrow} required />
              </div>
              <div className="space-y-2">
                <Label>Guests</Label>
                <Input name="guests_count" type="number" min={1} max={20} defaultValue={1} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Room type</Label>
              <select
                name="room_type_id"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.base_price} / night, sleeps {t.max_guests})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Guest name</Label>
                <Input name="guest_name" required />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input name="guest_phone" type="tel" required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>
                  Email <span className="text-xs text-muted-foreground">(optional — leave blank for stub)</span>
                </Label>
                <Input name="guest_email" type="email" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Payment method</Label>
                <select
                  name="payment_method"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="pay_at_hotel"
                >
                  <option value="pay_at_hotel">Pay at hotel</option>
                  <option value="online">Online</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Payment status</Label>
                <select
                  name="payment_status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="unpaid"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid now</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Provider (if paid)</Label>
                <select
                  name="payment_provider"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="cash"
                >
                  <option value="cash">Cash</option>
                  <option value="khalti">Khalti</option>
                  <option value="esewa">eSewa</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment reference (if paid)</Label>
                <Input name="payment_reference" placeholder="receipt # / txn id" />
              </div>
              <div className="space-y-2">
                <Label>Initial status</Label>
                <select
                  name="initial_status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="confirmed"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Check in immediately</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Special requests</Label>
              <Textarea name="special_requests" rows={2} />
            </div>

            <Button type="submit">Create booking</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
