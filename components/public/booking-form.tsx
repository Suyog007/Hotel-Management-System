"use client";

import { useMemo, useState } from "react";
import { CreditCard, Building2, ArrowRight, Snowflake, Wind } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { calculateBookingTotal, nightsBetween, round2 } from "@/lib/pricing";
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
  /** > 0 enables the optional AC add-on (Standard rooms only). */
  acAddonPrice?: number;
  action: (formData: FormData) => Promise<void>;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
}) {
  const today = useMemo(() => isoDate(0), []);
  const tomorrow = useMemo(() => isoDate(1), []);
  const [checkIn, setCheckIn] = useState(props.initialCheckIn || today);
  const [checkOut, setCheckOut] = useState(props.initialCheckOut || tomorrow);
  const [guests, setGuests] = useState(
    Math.min(Math.max(1, props.initialGuests || 1), props.maxGuests),
  );
  // Online payment (Khalti / eSewa) deferred — locked to pay_at_hotel for v1.
  const paymentMethod = "pay_at_hotel" as const;

  const acAddonPrice = props.acAddonPrice ?? 0;
  const [ac, setAc] = useState(false);
  const addonAmount = acAddonPrice > 0 && ac ? acAddonPrice : 0;

  const nights = nightsBetween(checkIn, checkOut);
  const roomCharge = round2(props.basePrice * nights);
  const totals = calculateBookingTotal({
    basePrice: props.basePrice,
    nights,
    taxRate: props.taxRate,
    serviceRate: props.serviceRate,
    addonAmount,
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

      {acAddonPrice > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Air conditioning
          </p>
          <input type="hidden" name="ac_addon" value={ac ? "on" : "off"} />
          <div className="grid grid-cols-2 gap-2">
            <PaymentChoice
              icon={Wind}
              label="Non-AC"
              hint="Included"
              selected={!ac}
              onClick={() => setAc(false)}
            />
            <PaymentChoice
              icon={Snowflake}
              label="AC"
              hint={`+${props.currencySymbol} ${acAddonPrice.toLocaleString()}`}
              selected={ac}
              onClick={() => setAc(true)}
            />
          </div>
        </div>
      )}

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
            selected
          />
          <PaymentChoice
            icon={CreditCard}
            label="Pay online"
            hint="Coming soon"
            selected={false}
            disabled
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
              <dd>{props.currencySymbol} {roomCharge.toLocaleString()}</dd>
            </div>
            {addonAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <dt>Air conditioning</dt>
                <dd>+{props.currencySymbol} {addonAmount.toLocaleString()}</dd>
              </div>
            )}
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

      <SubmitButton
        size="lg"
        className="w-full gap-2"
        disabled={!datesValid}
        pendingLabel="Sending verification code…"
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </SubmitButton>
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
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  selected: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className={cn(
        "flex flex-col gap-1 rounded-md border p-3 text-left text-sm transition-all",
        disabled && "cursor-not-allowed opacity-50",
        !disabled && selected
          ? "border-accent bg-accent/10 ring-2 ring-accent/30"
          : !disabled && "border-border bg-card hover:border-accent/40",
        disabled && "border-border bg-muted/30",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5",
          selected && !disabled ? "text-accent" : "text-muted-foreground",
        )}
      />
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
