"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * next/image that covers its slot with a pulsing placeholder + spinner until
 * the bitmap arrives, then fades the placeholder away. The overlay sits above
 * the image (fading it out, not the image in) so call-site transition classes
 * like `transition-transform` hover zooms are left untouched. Parent must be
 * `relative` (all call sites use `fill`).
 */
export function ImageWithLoader({ alt, onLoad, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <Image
        {...props}
        alt={alt}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center bg-muted transition-opacity duration-500",
          loaded ? "opacity-0" : "animate-pulse opacity-100"
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
      </span>
    </>
  );
}
