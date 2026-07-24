"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MAX_SLIDES = 6;

/**
 * Compact image slider for room cards. Scroll-snap based so touch swiping is
 * native; arrows fade in on hover for pointer devices; dots show position.
 * Lives inside a wrapping <Link>, so every control stops propagation and
 * prevents default — arrows/dots must never trigger the card navigation.
 * Fills its (relative) parent; parent decides the aspect ratio.
 */
export function CardImageSlider({
  images,
  alt,
  sizes = "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw",
}: {
  images: string[];
  alt: string;
  sizes?: string;
}) {
  const slides = images.slice(0, MAX_SLIDES);
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

  const slideTo = (e: React.MouseEvent, target: number) => {
    // Inside a <Link> — don't let the click bubble into a navigation.
    e.preventDefault();
    e.stopPropagation();
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(slides.length - 1, target));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  };

  if (slides.length <= 1) {
    return (
      <Image
        src={slides[0]}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        draggable={false}
      />
    );
  }

  return (
    <>
      <div
        ref={scrollerRef}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((src, i) => (
          <div key={`${src}-${i}`} className="relative h-full w-full shrink-0 snap-start">
            <Image
              src={src}
              alt={i === 0 ? alt : `${alt} — photo ${i + 1}`}
              fill
              sizes={sizes}
              className="object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={(e) => slideTo(e, index - 1)}
        disabled={index === 0}
        aria-label="Previous photo"
        className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/85 p-1.5 text-foreground opacity-0 shadow-soft backdrop-blur transition-opacity hover:bg-background focus-visible:opacity-100 disabled:opacity-0 group-hover:opacity-100 group-hover:disabled:opacity-30 md:block"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={(e) => slideTo(e, index + 1)}
        disabled={index === slides.length - 1}
        aria-label="Next photo"
        className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/85 p-1.5 text-foreground opacity-0 shadow-soft backdrop-blur transition-opacity hover:bg-background focus-visible:opacity-100 disabled:opacity-0 group-hover:opacity-100 group-hover:disabled:opacity-30 md:block"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => slideTo(e, i)}
            aria-label={`Photo ${i + 1} of ${slides.length}`}
            aria-current={i === index}
            className={`h-1.5 rounded-full shadow-soft transition-all ${
              i === index ? "w-4 bg-background" : "w-1.5 bg-background/60 hover:bg-background/90"
            }`}
          />
        ))}
      </div>
    </>
  );
}
