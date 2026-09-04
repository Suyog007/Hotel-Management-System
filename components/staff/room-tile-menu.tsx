"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Wrench, CheckCircle2 } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { setRoomStatus } from "@/app/(staff)/dashboard/bookings/actions";

type Info = {
  roomNumber: string;
  stateLabel: string;
  typeName: string;
  priceText: string | null;
};

/**
 * Click-to-open action menu for a room tile that has no guest today
 * (free / being cleaned / maintenance). Occupied tiles link to the booking
 * instead and never render this. Offers the housekeeping status changes that
 * make sense from the current state, each posting `setRoomStatus` and
 * returning to the overview. The tile visual is passed in as `children`.
 */
export function RoomTileMenu({
  roomId,
  state,
  info,
  children,
}: {
  roomId: string;
  state: "cleaning" | "maintenance" | "available";
  info: Info;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Room ${info.roomNumber}, ${info.stateLabel} — actions`}
        className="block cursor-pointer rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </button>

      {open && (
        <span className="absolute bottom-full left-1/2 z-30 mb-2 flex w-56 -translate-x-1/2 flex-col gap-1 rounded-md border border-foreground/10 bg-card p-3 text-left shadow-soft-lg">
          <span className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">#{info.roomNumber}</span>
            <span className="text-xs font-medium text-muted-foreground">{info.stateLabel}</span>
          </span>
          <span className="text-sm font-medium text-foreground">{info.typeName}</span>
          {info.priceText && <span className="text-xs text-muted-foreground">{info.priceText}</span>}

          <span className="mt-2 flex flex-col gap-1.5 border-t border-border/60 pt-2">
            {state === "cleaning" && (
              <StatusForm roomId={roomId} status="available" label="Mark ready (free)" icon={CheckCircle2} />
            )}
            {state === "maintenance" && (
              <StatusForm roomId={roomId} status="available" label="Mark available" icon={CheckCircle2} />
            )}
            {state === "available" && (
              <>
                <StatusForm roomId={roomId} status="cleaning" label="Send to cleaning" icon={Sparkles} />
                <StatusForm
                  roomId={roomId}
                  status="maintenance"
                  label="Set to maintenance"
                  icon={Wrench}
                  confirm="Put this room under maintenance? It won't be bookable until you mark it available again."
                />
              </>
            )}
          </span>
        </span>
      )}
    </span>
  );
}

function StatusForm({
  roomId,
  status,
  label,
  icon: Icon,
  confirm,
}: {
  roomId: string;
  status: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  confirm?: string;
}) {
  return (
    <form action={setRoomStatus}>
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="redirect_to" value="/dashboard" />
      <SubmitButton
        size="sm"
        variant="outline"
        pendingLabel="Updating…"
        confirmMessage={confirm}
        className="w-full justify-start"
      >
        <Icon className="h-4 w-4" />
        {label}
      </SubmitButton>
    </form>
  );
}
