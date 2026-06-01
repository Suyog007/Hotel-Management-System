"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function HeroSearch({ defaultGuests = 1 }: { defaultGuests?: number }) {
  const router = useRouter();
  const today = useMemo(() => toIsoDate(new Date()), []);
  const tomorrow = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return toIsoDate(t);
  }, []);

  const [checkIn, setCheckIn] = useState<string>(today);
  const [checkOut, setCheckOut] = useState<string>(tomorrow);
  const [guests, setGuests] = useState<number>(defaultGuests);
  const [error, setError] = useState<string | null>(null);

  // Keep check-out at least one day after check-in.
  const minCheckOut = useMemo(() => {
    if (!checkIn) return today;
    const d = new Date(checkIn);
    d.setDate(d.getDate() + 1);
    return toIsoDate(d);
  }, [checkIn, today]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkIn || !checkOut) {
      setError("Pick check-in and check-out dates.");
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      setError("Check-out must be after check-in.");
      return;
    }
    if (guests < 1) {
      setError("At least one guest.");
      return;
    }
    setError(null);
    const params = new URLSearchParams({
      check_in: checkIn,
      check_out: checkOut,
      guests: String(guests),
    });
    router.push(`/rooms?${params.toString()}#rooms`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl bg-background/95 p-3 shadow-soft-lg backdrop-blur sm:p-4"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <Field label="Check-in">
          <input
            type="date"
            value={checkIn}
            min={today}
            onChange={(e) => {
              setCheckIn(e.target.value);
              if (e.target.value && checkOut <= e.target.value) {
                const d = new Date(e.target.value);
                d.setDate(d.getDate() + 1);
                setCheckOut(toIsoDate(d));
              }
            }}
            className="w-full bg-transparent text-base font-medium text-foreground outline-none"
            required
          />
        </Field>
        <Field label="Check-out">
          <input
            type="date"
            value={checkOut}
            min={minCheckOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full bg-transparent text-base font-medium text-foreground outline-none"
            required
          />
        </Field>
        <Field label="Guests">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease guests"
              onClick={() => setGuests((g) => Math.max(1, g - 1))}
              className="grid h-7 w-7 place-items-center rounded-full border border-border text-sm text-muted-foreground hover:border-accent/40 hover:text-foreground"
            >
              −
            </button>
            <span className="min-w-[1.5rem] text-center text-base font-medium tabular-nums">
              {guests}
            </span>
            <button
              type="button"
              aria-label="Increase guests"
              onClick={() => setGuests((g) => Math.min(10, g + 1))}
              className="grid h-7 w-7 place-items-center rounded-full border border-border text-sm text-muted-foreground hover:border-accent/40 hover:text-foreground"
            >
              +
            </button>
          </div>
        </Field>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 sm:h-[60px]"
        >
          <Search className="h-4 w-4" />
          Check availability
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block cursor-pointer rounded-xl border border-border/60 bg-background px-3 py-2.5 transition-colors focus-within:border-accent hover:border-accent/40">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}
