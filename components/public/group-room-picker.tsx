"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, Building2, CreditCard, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { CardImageSlider } from "./card-image-slider";
import { cn } from "@/lib/utils";
import { MAX_ROOMS_PER_BOOKING } from "@/lib/validation/rooms";

export type PickerRoom = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  maxGuests: number;
  availableCount: number;
  totalForStay: number;
};

type Stay = { checkIn: string; checkOut: string; guests: number; nights: number };

/**
 * Group-booking cart on /rooms: every room type gets a quantity stepper, a
 * sticky bar tracks capacity vs the party, and once everyone fits one form
 * books all the rooms in a single OTP-verified go (initiateGroupBooking).
 * Rendered only when the party is larger than the largest room.
 */
export function GroupRoomPicker(props: {
  rooms: PickerRoom[];
  roomImages: Record<string, string[]>;
  stay: Stay;
  symbol: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const checkoutRef = useRef<HTMLDivElement | null>(null);

  const picked = useMemo(
    () => props.rooms.filter((r) => (qty[r.id] ?? 0) > 0),
    [props.rooms, qty],
  );
  const roomCount = picked.reduce((n, r) => n + (qty[r.id] ?? 0), 0);
  const capacity = picked.reduce((n, r) => n + (qty[r.id] ?? 0) * r.maxGuests, 0);
  const total = picked.reduce((n, r) => n + (qty[r.id] ?? 0) * r.totalForStay, 0);
  const ready =
    roomCount >= 1 &&
    capacity >= props.stay.guests &&
    props.stay.guests >= roomCount;

  const selectionJson = JSON.stringify(
    picked.map((r) => ({ room_type_id: r.id, quantity: qty[r.id] ?? 0 })),
  );

  function bump(roomId: string, delta: number, max: number) {
    setQty((q) => {
      const current = q[roomId] ?? 0;
      const othersCount = roomCount - current;
      const cap = Math.min(max, MAX_ROOMS_PER_BOOKING - othersCount);
      const next = Math.max(0, Math.min(cap, current + delta));
      return { ...q, [roomId]: next };
    });
    if (delta < 0) setCheckoutOpen(false);
  }

  function openCheckout() {
    setCheckoutOpen(true);
    requestAnimationFrame(() => {
      checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {props.rooms.map((r) => {
          const n = qty[r.id] ?? 0;
          const images = props.roomImages[r.id] ?? [];
          return (
            <article
              key={r.id}
              className={cn(
                "flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-soft transition-all",
                n > 0 ? "border-accent ring-2 ring-accent/30" : "border-border/60",
              )}
            >
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
                {images.length > 0 ? (
                  <CardImageSlider images={images} alt={`${r.name} at Hotel Vardani, Gaushala`} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-accent/10 to-transparent">
                    <span className="font-display text-3xl font-semibold text-foreground/30">
                      {r.name}
                    </span>
                  </div>
                )}
                <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-soft backdrop-blur">
                  <Users className="h-3 w-3" />
                  Sleeps {r.maxGuests}
                </div>
                <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-lg bg-gold px-3.5 py-2 text-right text-onyx shadow-soft">
                  <span className="font-display text-2xl font-bold leading-none">
                    {props.symbol} {r.totalForStay.toLocaleString()}
                  </span>{" "}
                  <span className="text-xs font-medium text-onyx/70">total</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-xl font-semibold leading-tight">
                  <Link
                    href={`/rooms/${r.slug}?check_in=${props.stay.checkIn}&check_out=${props.stay.checkOut}&guests=${props.stay.guests}`}
                    className="hover:underline"
                  >
                    {r.name}
                  </Link>
                </h2>
                <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                  {r.description}
                </p>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="text-xs text-muted-foreground">
                    {r.availableCount} room{r.availableCount === 1 ? "" : "s"} left
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Remove a ${r.name}`}
                      onClick={() => bump(r.id, -1, r.availableCount)}
                      disabled={n === 0}
                      className="grid h-8 w-8 place-items-center rounded-full border border-border text-base text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="min-w-[1.5rem] text-center text-base font-medium tabular-nums">
                      {n}
                    </span>
                    <button
                      type="button"
                      aria-label={`Add a ${r.name}`}
                      onClick={() => bump(r.id, 1, r.availableCount)}
                      disabled={n >= r.availableCount || roomCount >= MAX_ROOMS_PER_BOOKING}
                      className="grid h-8 w-8 place-items-center rounded-full border border-border text-base text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Sticky selection summary — follows the guest while they pick. */}
      <div className="sticky bottom-4 z-30 mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/95 p-4 shadow-soft-lg backdrop-blur">
          <div className="text-sm">
            {roomCount === 0 ? (
              <p className="text-muted-foreground">
                Add rooms with the <span className="font-medium text-foreground">+</span>{" "}
                buttons until everyone has a bed.
              </p>
            ) : (
              <>
                <p className="font-medium">
                  {roomCount} room{roomCount === 1 ? "" : "s"} · sleeps{" "}
                  {Math.min(capacity, props.stay.guests)} of {props.stay.guests} guests
                </p>
                <p className="text-muted-foreground">
                  {props.symbol} {total.toLocaleString()} total for {props.stay.nights}{" "}
                  night{props.stay.nights === 1 ? "" : "s"}
                  {!ready &&
                    capacity < props.stay.guests &&
                    ` — room for ${props.stay.guests - capacity} more needed`}
                  {!ready && props.stay.guests < roomCount && " — more rooms than guests"}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={openCheckout}
            disabled={!ready}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {checkoutOpen && ready && (
        <div
          ref={checkoutRef}
          className="mt-8 scroll-mt-24 rounded-2xl border border-border/60 bg-card p-6 shadow-soft md:p-8"
        >
          <h2 className="font-display text-2xl font-semibold">Book your rooms</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {props.stay.checkIn} → {props.stay.checkOut} · {props.stay.guests} guests ·
            one confirmation covers all {roomCount} rooms.
          </p>

          <div className="mt-5 grid gap-8 md:grid-cols-[1fr_320px]">
            <form action={props.action} className="space-y-5">
              <input type="hidden" name="check_in" value={props.stay.checkIn} />
              <input type="hidden" name="check_out" value={props.stay.checkOut} />
              <input type="hidden" name="guests_count" value={props.stay.guests} />
              <input type="hidden" name="payment_method" value="pay_at_hotel" />
              <input type="hidden" name="selection" value={selectionJson} />

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
                <div className="space-y-1.5">
                  <Label htmlFor="special_requests">
                    Special requests{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea id="special_requests" name="special_requests" rows={2} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1 rounded-md border border-accent bg-accent/10 p-3 text-left text-sm ring-2 ring-accent/30">
                  <Building2 className="h-5 w-5 text-accent" />
                  <span className="font-medium">Pay at hotel</span>
                  <span className="text-xs text-muted-foreground">Settle on arrival</span>
                </div>
                <div className="flex cursor-not-allowed flex-col gap-1 rounded-md border border-border bg-muted/30 p-3 text-left text-sm opacity-50">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Pay online</span>
                  <span className="text-xs text-muted-foreground">Coming soon</span>
                </div>
              </div>

              <SubmitButton
                size="lg"
                className="w-full gap-2"
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

            <div className="h-fit rounded-md border border-border bg-muted/40 p-4 text-sm">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your rooms
              </p>
              <dl className="space-y-1.5">
                {picked.map((r) => (
                  <div key={r.id} className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {qty[r.id]} × {r.name}
                    </dt>
                    <dd>
                      {props.symbol}{" "}
                      {((qty[r.id] ?? 0) * r.totalForStay).toLocaleString()}
                    </dd>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-border pt-2 font-display text-base font-semibold">
                  <dt>Total</dt>
                  <dd>
                    {props.symbol} {total.toLocaleString()}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Each room becomes its own booking under your name — cancel or adjust
                any of them individually later.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
