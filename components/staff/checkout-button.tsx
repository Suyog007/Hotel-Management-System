"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * The bookings-page "Check out" control. A settled booking checks out with one
 * click; an unpaid one opens a payment-collection dialog first, so the desk
 * records the money in the same gesture that ends the stay — the primary
 * button submits with `collect=1` (the server tops up paid_amount, flips
 * payment_status and writes a payments row), while "Check out unpaid" skips
 * collection for the rare walk-away/comp case.
 */
export function CheckOutButton({
  bookingId,
  action,
  outstanding,
  symbol,
}: {
  bookingId: string;
  action: (formData: FormData) => void | Promise<void>;
  /** Amount still owed; 0 or less renders the plain one-click button. */
  outstanding: number;
  symbol: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (outstanding <= 0) {
    return (
      <form action={action}>
        <input type="hidden" name="id" value={bookingId} />
        <SubmitButton size="sm" variant="accent" pendingLabel="Checking out…">
          Check out
        </SubmitButton>
      </form>
    );
  }

  const amount = `${symbol} ${outstanding.toLocaleString()}`;

  return (
    <>
      <Button size="sm" variant="accent" type="button" onClick={() => setOpen(true)}>
        Check out
      </Button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-foreground/40 backdrop-blur-sm"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Collect payment and check out"
            className="relative w-full max-w-sm rounded-md border border-foreground/10 bg-card p-5 shadow-soft-lg"
          >
            <div className="flex items-start gap-3">
              <Banknote aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-semibold">Collect {amount}?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This booking is unpaid. Record the payment as you check the guest out.
                </p>
              </div>
            </div>

            <form action={action} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={bookingId} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Method</Label>
                  <select
                    name="payment_provider"
                    defaultValue="cash"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="khalti">Khalti</option>
                    <option value="esewa">eSewa</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reference (optional)</Label>
                  <Input name="payment_reference" placeholder="receipt / txn id" className="h-9" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                {/* Submitter name/value ride along in the FormData, so only
                    this button flags the server to record the payment. */}
                <SubmitButton
                  size="sm"
                  variant="accent"
                  name="collect"
                  value="1"
                  pendingLabel="Checking out…"
                >
                  Collect {amount} &amp; check out
                </SubmitButton>
              </div>
              <div className="text-right">
                <SubmitButton
                  size="sm"
                  variant="ghost"
                  formNoValidate
                  pendingLabel="Checking out…"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Check out unpaid
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
