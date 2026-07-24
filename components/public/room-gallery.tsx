"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { ImageLightbox } from "./image-lightbox";

/**
 * Room-detail gallery: a scroll-snap slider over EVERY room photo (the old
 * asymmetric grid capped at 5), with arrows, a position counter, and a
 * thumbnail rail. Clicking the main image opens the lightbox at that photo.
 */
export function RoomGallery({ name, images }: { name: string; images: string[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const slideTo = (target: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(images.length - 1, target));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  };

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent">
        <p className="font-display text-4xl font-semibold text-foreground/30">
          {name}
        </p>
      </div>
    );
  }

  const lightboxImages = images.map((url) => ({ url, alt: name }));

  return (
    <ImageLightbox images={lightboxImages}>
      {(open) => (
        <div>
          <div className="group relative overflow-hidden rounded-2xl">
            <div
              ref={scrollerRef}
              className="flex aspect-[16/10] w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {images.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => open(i)}
                  aria-label={`View ${name} — photo ${i + 1} of ${images.length}`}
                  className="relative h-full w-full shrink-0 snap-start"
                >
                  <Image
                    src={src}
                    alt={i === 0 ? name : `${name} — photo ${i + 1}`}
                    fill
                    sizes="(min-width: 1024px) 66vw, 100vw"
                    className="object-cover"
                    priority={i === 0}
                    draggable={false}
                  />
                </button>
              ))}
            </div>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => slideTo(index - 1)}
                  disabled={index === 0}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/85 p-2 text-foreground shadow-soft backdrop-blur transition-opacity hover:bg-background disabled:opacity-30 md:block"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => slideTo(index + 1)}
                  disabled={index === images.length - 1}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/85 p-2 text-foreground shadow-soft backdrop-blur transition-opacity hover:bg-background disabled:opacity-30 md:block"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-foreground/80 px-3 py-1 font-label text-[11px] text-background backdrop-blur">
              <Expand className="h-3 w-3" />
              {index + 1} / {images.length}
            </div>
          </div>

          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {images.map((src, i) => (
                <button
                  key={`thumb-${src}-${i}`}
                  type="button"
                  onClick={() => slideTo(i)}
                  aria-label={`Go to photo ${i + 1}`}
                  aria-current={i === index}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg transition-all ${
                    i === index
                      ? "ring-2 ring-accent ring-offset-2 ring-offset-background"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </ImageLightbox>
  );
}
