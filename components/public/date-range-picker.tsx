"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function ymd(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  const leading = first.getUTCDay();
  const cells: ({ iso: string; day: number } | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= last.getUTCDate(); d++) {
    cells.push({ iso: ymd(new Date(Date.UTC(year, month, d))), day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DateRangePicker({
  roomTypeId,
  checkIn,
  checkOut,
  onChange,
}: {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  onChange: (range: { check_in: string; check_out: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<"in" | "out">("in");
  const wrapRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => ymd(new Date()), []);
  const [cursorYear, setCursorYear] = useState(() => new Date().getUTCFullYear());
  const [cursorMonth, setCursorMonth] = useState(() => new Date().getUTCMonth());

  // Fetch blocked dates lazily on first open.
  useEffect(() => {
    if (!open || blocked.size > 0 || loading) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/availability?room_type_id=${roomTypeId}`)
      .then((r) => r.json())
      .then((data: { blockedDates?: string[]; error?: string }) => {
        if (!alive) return;
        if (data.error) setError(data.error);
        else setBlocked(new Set(data.blockedDates ?? []));
      })
      .catch((e) => {
        if (alive) setError(e.message || "Failed to load availability");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, blocked.size, loading, roomTypeId]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  function isBlocked(iso: string) {
    return iso < today || blocked.has(iso);
  }

  // A range is rejected if any day inside it (excluding check_out) is blocked.
  function rangeHasBlocked(inIso: string, outIso: string) {
    for (let d = inIso; d < outIso; d = addDays(d, 1)) {
      if (blocked.has(d)) return true;
    }
    return false;
  }

  function pick(iso: string) {
    if (isBlocked(iso)) return;
    if (selecting === "in") {
      onChange({ check_in: iso, check_out: addDays(iso, 1) });
      setSelecting("out");
      return;
    }
    // Selecting check_out
    if (iso <= checkIn) {
      // Treat as starting over.
      onChange({ check_in: iso, check_out: addDays(iso, 1) });
      setSelecting("out");
      return;
    }
    if (rangeHasBlocked(checkIn, iso)) {
      setError("That range crosses a fully-booked day. Pick a shorter stay.");
      return;
    }
    setError(null);
    onChange({ check_in: checkIn, check_out: iso });
    setSelecting("in");
    setOpen(false);
  }

  const grids = [0, 1].map((offset) => {
    const m = cursorMonth + offset;
    const y = cursorYear + Math.floor(m / 12);
    const mn = ((m % 12) + 12) % 12;
    return { year: y, month: mn, cells: buildMonthGrid(y, mn) };
  });

  const stayNights = (() => {
    const ms =
      new Date(checkOut + "T00:00:00Z").getTime() -
      new Date(checkIn + "T00:00:00Z").getTime();
    return Math.max(0, Math.round(ms / 86400000));
  })();

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-2 gap-2 rounded-md border border-border bg-card p-2 text-left transition-colors hover:border-accent/40"
        aria-expanded={open}
      >
        <div className="px-2 py-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Check-in
          </p>
          <p className="text-sm font-medium">
            {new Date(checkIn + "T00:00:00Z").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
        </div>
        <div className="border-l border-border px-2 py-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Check-out · {stayNights} night{stayNights === 1 ? "" : "s"}
          </p>
          <p className="text-sm font-medium">
            {new Date(checkOut + "T00:00:00Z").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-xl border border-border bg-card p-4 shadow-soft-lg">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const newMonth = cursorMonth - 1;
                if (newMonth < 0) {
                  setCursorMonth(11);
                  setCursorYear((y) => y - 1);
                } else {
                  setCursorMonth(newMonth);
                }
              }}
              aria-label="Previous month"
              className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {loading ? "Loading availability…" : `${blocked.size} fully-booked day${blocked.size === 1 ? "" : "s"} in range`}
            </div>
            <button
              type="button"
              onClick={() => {
                const newMonth = cursorMonth + 1;
                if (newMonth > 11) {
                  setCursorMonth(0);
                  setCursorYear((y) => y + 1);
                } else {
                  setCursorMonth(newMonth);
                }
              }}
              aria-label="Next month"
              className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {grids.map((g) => (
              <div key={`${g.year}-${g.month}`}>
                <p className="mb-3 text-center text-sm font-semibold">
                  {monthLabel(g.year, g.month)}
                </p>
                <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {g.cells.map((cell, i) => {
                    if (!cell) return <div key={i} />;
                    const blocked = isBlocked(cell.iso);
                    const isCheckIn = cell.iso === checkIn;
                    const isCheckOut = cell.iso === checkOut;
                    const inRange = cell.iso > checkIn && cell.iso < checkOut;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={blocked}
                        onClick={() => pick(cell.iso)}
                        className={cn(
                          "h-9 rounded-md text-sm transition-colors",
                          blocked && "cursor-not-allowed text-muted-foreground/40 line-through",
                          !blocked && !isCheckIn && !isCheckOut && !inRange && "hover:bg-muted",
                          (isCheckIn || isCheckOut) && "bg-primary text-primary-foreground font-medium",
                          inRange && "bg-accent/15 text-foreground",
                        )}
                        aria-label={cell.iso}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between text-xs">
            <p className="text-muted-foreground">
              {selecting === "in"
                ? "Pick a check-in date."
                : "Pick a check-out date."}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-border bg-card px-3 py-1.5 font-medium hover:bg-muted"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
