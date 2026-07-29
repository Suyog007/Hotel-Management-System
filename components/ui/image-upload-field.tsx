"use client";

import * as React from "react";
import { ImagePlus, Link2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const FILE_INPUT_CLASS =
  "block w-full cursor-pointer rounded-md border border-input bg-card text-sm text-muted-foreground shadow-sm transition-colors hover:border-foreground/30 file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-input file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground";

/**
 * Pick a photo from the computer instead of hunting down a URL.
 *
 * Submits two fields: `fileName` (the upload) and `name` (the existing URL).
 * The server action uploads the file when one was chosen and otherwise keeps
 * the URL, so pasting a link still works — it's just demoted to a disclosure
 * for the rare case where the image already lives somewhere else.
 */
export function ImageUploadField({
  name,
  fileName,
  label = "Photo",
  value = "",
  hint,
  className,
}: {
  /** Form field carrying the existing/typed URL. */
  name: string;
  /** Form field carrying the uploaded file. */
  fileName: string;
  label?: string;
  value?: string;
  hint?: string;
  className?: string;
}) {
  const [url, setUrl] = React.useState(value);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [fileLabel, setFileLabel] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Object URLs leak until revoked.
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (preview) URL.revokeObjectURL(preview);
    if (!file) {
      setPreview(null);
      setFileLabel(null);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setFileLabel(file.name);
  };

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileLabel(null);
    setUrl("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const shown = preview ?? (url || null);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={fileName}>{label}</Label>

      <div className="flex items-start gap-3">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md border border-input bg-muted/40">
          {shown ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shown} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={clear}
                aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground shadow transition-colors hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImagePlus aria-hidden className="h-6 w-6" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={fileRef}
            id={fileName}
            type="file"
            name={fileName}
            accept="image/*"
            onChange={onPick}
            className={FILE_INPUT_CLASS}
          />
          <p className="text-xs text-muted-foreground">
            {fileLabel
              ? `${fileLabel} — uploads when you save.`
              : (hint ?? "PNG, JPEG, WebP or GIF. Max 10 MB.")}
          </p>
        </div>
      </div>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <Link2 aria-hidden className="h-3.5 w-3.5" />
          <span className="group-open:hidden">Or use a link instead</span>
          <span className="hidden group-open:inline">Hide link field</span>
        </summary>
        <Input
          name={name}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="mt-2"
        />
      </details>
    </div>
  );
}
