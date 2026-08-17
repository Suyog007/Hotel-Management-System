"use client";

import * as React from "react";
import { Check, Plus, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Same split the server-side schema uses, so what you see is what gets saved. */
function parse(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\r\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Tick-list for a room type's amenities, replacing the free-text box that made
 * every room a fresh chance to typo "Attached bathroom".
 *
 * Selection is the source of truth and is submitted as one newline-separated
 * hidden field, so the server action and zod schema stay exactly as they were.
 * Anything already on the record that isn't a known option still shows as a
 * chip — editing an old room type never silently drops its amenities.
 */
export function AmenityPicker({
  name,
  options,
  value = [],
  label = "Amenities",
  className,
}: {
  /** Form field carrying the newline-separated list. */
  name: string;
  /** Suggested amenities, in display order. */
  options: string[];
  value?: string[];
  label?: string;
  className?: string;
}) {
  // The raw text is the source of truth, not a parsed array: deriving the
  // textarea's contents from an array would swallow the newline the moment you
  // press Enter in it. The chips read back out of it.
  const [text, setText] = React.useState(value.join("\n"));
  const [custom, setCustom] = React.useState("");

  const selected = React.useMemo(() => parse(text), [text]);

  // Known options first, then anything this record carries that isn't one —
  // legacy or one-off values stay visible and removable rather than vanishing.
  const chips = React.useMemo(() => {
    const seen = new Set(options.map((o) => o.toLowerCase()));
    return [...options, ...selected.filter((s) => !seen.has(s.toLowerCase()))];
  }, [options, selected]);

  const isOn = (a: string) => selected.some((s) => s.toLowerCase() === a.toLowerCase());

  const toggle = (a: string) =>
    setText(
      (isOn(a)
        ? selected.filter((s) => s.toLowerCase() !== a.toLowerCase())
        : [...selected, a]
      ).join("\n"),
    );

  const addCustom = () => {
    // Split the same way the schema does: typing "Kettle, Iron" adds two.
    const added = parse(custom).filter((a) => !isOn(a));
    if (added.length) setText([...selected, ...added].join("\n"));
    setCustom("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>

      <input type="hidden" name={name} value={text} />

      <div className="flex flex-wrap gap-1.5">
        {chips.map((a) => {
          const on = isOn(a);
          return (
            <button
              key={a}
              type="button"
              onClick={() => toggle(a)}
              aria-pressed={on}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                on
                  ? "border-accent bg-accent/10 font-medium text-foreground"
                  : "border-input bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              <Check
                aria-hidden
                className={cn("h-3.5 w-3.5 shrink-0", on ? "opacity-100" : "opacity-25")}
              />
              {a}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            // Enter inside a form would submit it — add the amenity instead.
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Something else — e.g. Kettle"
          aria-label="Add another amenity"
          className="h-9 max-w-xs"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={custom.trim() === ""}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-2.5 py-1.5 text-sm font-medium transition-colors hover:border-foreground/30 disabled:opacity-40"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {selected.length === 0
          ? "None selected — the room card will show no amenities."
          : `${selected.length} selected.`}
      </p>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <Pencil aria-hidden className="h-3.5 w-3.5" />
          <span className="group-open:hidden">Or edit as text (one per line)</span>
          <span className="hidden group-open:inline">Hide text list</span>
        </summary>
        <Textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Wi-Fi\nAir conditioning"}
          className="mt-2"
        />
      </details>
    </div>
  );
}
