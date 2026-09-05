import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormActions } from "@/components/ui/form-actions";
import { StatusNote } from "@/components/ui/status-note";
import { WalkInRoomPicker } from "@/components/staff/walk-in-room-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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

      <StatusNote error={sp.error} />

      <Card>
        <CardHeader>
          <CardTitle>New walk-in</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createWalkInBooking} className="space-y-5">
            <WalkInRoomPicker types={types} today={today} tomorrow={tomorrow} />

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
                <Select
                  name="payment_method"
                  required
                  defaultValue="pay_at_hotel"
                >
                  <option value="pay_at_hotel">Pay at hotel</option>
                  <option value="online">Online</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment status</Label>
                <Select
                  name="payment_status"
                  defaultValue="unpaid"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid now</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Provider (if paid)</Label>
                <Select
                  name="payment_provider"
                  defaultValue="cash"
                >
                  <option value="cash">Cash</option>
                  <option value="khalti">Khalti</option>
                  <option value="esewa">eSewa</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment reference (if paid)</Label>
                <Input name="payment_reference" placeholder="receipt # / txn id" />
              </div>
              <div className="space-y-2">
                <Label>Initial status</Label>
                <Select
                  name="initial_status"
                  defaultValue="confirmed"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Check in immediately</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Special requests</Label>
              <Textarea name="special_requests" rows={2} />
            </div>

            <FormActions>
              <SubmitButton pendingLabel="Creating booking…">Create booking</SubmitButton>
            </FormActions>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
