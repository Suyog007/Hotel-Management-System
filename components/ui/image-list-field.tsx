"use client";

import * as React from "react";
import { ImagePlus, Link2, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const FILE_INPUT_CLASS =
  "block w-full cursor-pointer rounded-md border border-input bg-card text-sm text-muted-foreground shadow-sm transition-colors hover:border-foreground/30 file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-input file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground";

/**
 * Multi-photo picker for records that hold a list of images (room types).
 *
 * Existing photos show as thumbnails you can remove with a click; new ones are
 * picked from disk and appended by the server action on save. The newline-per-
 * URL textarea the page used to expose is still there, now behind a disclosure
 * and kept in sync — it's the only way to reorder or paste an off-site link.
 */
export function ImageListField({
  name,
  fileName,
  label = "Photos",
  value = [],
  className,
}: {
  /** Form field carrying the newline-separated list of existing URLs. */
  name: string;
  /** Form field carrying the newly picked files. */
  fileName: string;
  label?: string;
  value?: string[];
  className?: string;
}) {
  // The textarea's raw text is the source of truth — deriving it from a parsed
  // array would swallow the newline the moment you press Enter.
  const [text, setText] = React.useState(value.join("\n"));
  const [pending, setPending] = React.useState<string[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const urls = React.useMemo(
    () => text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    [text],
  );

  React.useEffect(() => {
    return () => {
      for (const p of pending) URL.revokeObjectURL(p);
    };
  }, [pending]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const p of pending) URL.revokeObjectURL(p);
    const files = Array.from(e.target.files ?? []);
    setPending(files.map((f) => URL.createObjectURL(f)));
  };

  const removeAt = (i: number) => setText(urls.filter((_, n) => n !== i).join("\n"));

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={fileName}>{label}</Label>

      {(urls.length > 0 || pending.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {urls.map((u, i) => (
            <div
              key={`${u}-${i}`}
              className="relative h-20 w-28 overflow-hidden rounded-md border border-input bg-muted/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground shadow transition-colors hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {pending.map((p, i) => (
            <div
              key={p}
              className="relative h-20 w-28 overflow-hidden rounded-md border border-dashed border-accent bg-muted/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="h-full w-full object-cover opacity-80" />
              <span className="absolute inset-x-0 bottom-0 bg-background/85 px-1 py-0.5 text-center text-[10px] font-medium">
                new #{i + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {urls.length === 0 && pending.length === 0 && (
        <div className="flex h-20 w-28 items-center justify-center rounded-md border border-input bg-muted/40 text-muted-foreground">
          <ImagePlus aria-hidden className="h-6 w-6" />
        </div>
      )}

      <input
        ref={fileRef}
        id={fileName}
        type="file"
        name={fileName}
        accept="image/*"
        multiple
        onChange={onPick}
        className={FILE_INPUT_CLASS}
      />
      <p className="text-xs text-muted-foreground">
        {pending.length > 0
          ? `${pending.length} new photo${pending.length === 1 ? "" : "s"} — upload${pending.length === 1 ? "s" : ""} when you save.`
          : "Pick one or more. PNG, JPEG, WebP or GIF, max 10 MB each."}
      </p>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <Link2 aria-hidden className="h-3.5 w-3.5" />
          <span className="group-open:hidden">Or edit links directly (one per line)</span>
          <span className="hidden group-open:inline">Hide link list</span>
        </summary>
        <Textarea
          name={name}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"https://…\nhttps://…"}
          className="mt-2"
        />
      </details>
    </div>
  );
}
