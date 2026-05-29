"use client";

import { useMemo, useState } from "react";
import { CreditCard, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { calculateBookingTotal, nightsBetween } from "@/lib/pricing";
import { DateRangePicker } from "./date-range-picker";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function BookingForm(props: {
  slug: string;
  roomTypeId: string;
  basePrice: number;
  maxGuests: number;
  taxRate: number;
  serviceRate: number;
  currencySymbol: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const today = useMemo(() => isoDate(0), []);
  const tomorrow = useMemo(() => isoDate(1), []);
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guests, setGuests] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "pay_at_hotel">(
    "pay_at_hotel",
  );

  const nights = nightsBetween(checkIn, checkOut);
  const totals = calculateBookingTotal({
    basePrice: props.basePrice,
    nights,
    taxRate: props.taxRate,
    serviceRate: props.serviceRate,
  });
  const datesValid = nights >= 1;

  return (
    <form action={props.action} className="space-y-5">
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="room_type_id" value={props.roomTypeId} />
      <input type="hidden" name="payment_method" value={paymentMethod} />
      <input type="hidden" name="check_in" value={checkIn} />
      <input type="hidden" name="check_out" value={checkOut} />

      <DateRangePicker
        roomTypeId={props.roomTypeId}
        checkIn={checkIn}
        checkOut={checkOut}
        onChange={({ check_in, check_out }) => {
          setCheckIn(check_in);
          setCheckOut(check_out);
        }}
      />

      <div className="space-y-2">
        <Label htmlFor="guests_count">Guests</Label>
        <Input
          id="guests_count"
          name="guests_count"
          type="number"
          min={1}
          max={props.maxGuests}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          required
        />
        <p className="text-xs text-muted-foreground">
          Max {props.maxGuests} per booking for this room.
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Guest details
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="guest_name">Full name</Label>
            <Input id="guest_name" name="guest_name" required autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest_email">
              Email{" "}
              <span className="text-muted-foreground">
                (verification code goes here)
              </span>
            </Label>
            <Input
              id="guest_email"
              name="guest_email"
              type="email"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest_phone">Phone</Label>
            <Input
              id="guest_phone"
              name="guest_phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="+977-…"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Payment
        </p>
        <div className="grid grid-cols-2 gap-2">
          <PaymentChoice
            icon={Building2}
            label="Pay at hotel"
            hint="Settle on arrival"
            selected={paymentMethod === "pay_at_hotel"}
            onClick={() => setPaymentMethod("pay_at_hotel")}
          />
          <PaymentChoice
            icon={CreditCard}
            label="Pay online"
            hint="Khalti / eSewa"
            selected={paymentMethod === "online"}
            onClick={() => setPaymentMethod("online")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="special_requests">
          Special requests{" "}
          <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="special_requests" name="special_requests" rows={2} />
      </div>

      <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
        {!datesValid ? (
          <p className="text-muted-foreground">
            Pick valid check-in and check-out dates.
          </p>
        ) : (
          <dl className="space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {props.currencySymbol} {props.basePrice.toLocaleString()} ×{" "}
                {nights} night{nights === 1 ? "" : "s"}
              </dt>
              <dd>{props.currencySymbol} {totals.subtotal.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Tax ({(props.taxRate * 100).toFixed(1)}%)</dt>
              <dd>
                {props.currencySymbol} {totals.taxAmount.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Service ({(props.serviceRate * 100).toFixed(1)}%)</dt>
              <dd>
                {props.currencySymbol} {totals.serviceAmount.toLocaleString()}
              </dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-display text-base font-semibold">
              <dt>Total</dt>
              <dd>{props.currencySymbol} {totals.total.toLocaleString()}</dd>
            </div>
          </dl>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full gap-2" disabled={!datesValid}>
        Continue
        <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        We&apos;ll email a 6-digit code to verify. Final price is recomputed on
        the server.
      </p>
    </form>
  );
}

function PaymentChoice({
  icon: Icon,
  label,
  hint,
  selected,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-1 rounded-md border p-3 text-left text-sm transition-all",
        selected
          ? "border-accent bg-accent/10 ring-2 ring-accent/30"
          : "border-border bg-card hover:border-accent/40",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5",
          selected ? "text-accent" : "text-muted-foreground",
        )}
      />
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
