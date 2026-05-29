"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type LightboxImage = { url: string; caption?: string | null; alt?: string };

/**
 * A keyboard-navigable image lightbox.
 *
 * Usage:
 *   <ImageLightbox images={[{url, caption}, ...]}>
 *     {(open) => (
 *       <button onClick={() => open(0)}>...</button>
 *     )}
 *   </ImageLightbox>
 *
 * The render-prop `open(index)` opens the modal at that index. Children
 * is the only way to render triggers — keeps the API explicit and lets
 * the caller style thumbnails however it wants.
 */
export function ImageLightbox({
  images,
  children,
}: {
  images: LightboxImage[];
  children: (open: (index: number) => void) => React.ReactNode;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isOpen = openIndex !== null;

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? 0 : (i + 1) % images.length)),
    [images.length],
  );
  const prev = useCallback(
    () =>
      setOpenIndex((i) =>
        i === null ? 0 : (i - 1 + images.length) % images.length,
      ),
    [images.length],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close, next, prev]);

  const current = openIndex !== null ? images[openIndex] : null;

  return (
    <>
      {children((i) => setOpenIndex(i))}

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={current.caption ?? "Image preview"}
          className="fixed inset-0 z-50 flex flex-col bg-foreground/95 backdrop-blur-sm"
          onClick={close}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between p-4 text-primary-foreground">
            <p className="text-sm font-medium text-primary-foreground/80">
              {openIndex! + 1} / {images.length}
            </p>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="rounded-md p-2 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Image stage */}
          <div
            className="relative flex flex-1 items-center justify-center px-4 pb-16"
            onClick={(e) => e.stopPropagation()}
          >
            {images.length > 1 && (
              <button
                type="button"
                onClick={prev}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-primary-foreground/10 p-3 text-primary-foreground transition-colors hover:bg-primary-foreground/20 md:left-6"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <div className="relative h-full max-h-[80vh] w-full max-w-5xl">
              <Image
                src={current.url}
                alt={current.alt ?? current.caption ?? ""}
                fill
                sizes="100vw"
                className="object-contain"
                priority
              />
            </div>

            {images.length > 1 && (
              <button
                type="button"
                onClick={next}
                aria-label="Next image"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary-foreground/10 p-3 text-primary-foreground transition-colors hover:bg-primary-foreground/20 md:right-6"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Caption strip */}
          {current.caption && (
            <div
              className="border-t border-primary-foreground/10 px-4 py-3 text-center text-sm text-primary-foreground/80"
              onClick={(e) => e.stopPropagation()}
            >
              {current.caption}
            </div>
          )}
        </div>
      )}
    </>
  );
}
