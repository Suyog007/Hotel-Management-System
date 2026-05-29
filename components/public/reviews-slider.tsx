"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export type SliderReview = {
  id: string;
  source: "google" | "testimonial";
  author_name: string;
  author_role: string | null;
  author_photo_url: string | null;
  rating: number | null;
  body: string;
  published_at: string | null;
};

/**
 * Horizontal scroll-snap slider for reviews. Native browser smooth scrolling
 * + scroll-snap so the sliding feels right on touch devices for free.
 * Arrow buttons appear when there's more than one card.
 */
export function ReviewsSlider({ reviews }: { reviews: SliderReview[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateButtons = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateButtons();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      window.removeEventListener("resize", updateButtons);
    };
  }, [updateButtons, reviews.length]);

  const slideBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // One card-width per click, approximately.
    const card = el.querySelector<HTMLElement>("[data-review-card]");
    const step = card ? card.offsetWidth + 16 /* gap */ : el.clientWidth * 0.85;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  if (reviews.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-6 md:px-0"
      >
        {reviews.map((r) => (
          <article
            key={r.id}
            data-review-card
            className="flex w-[85%] shrink-0 snap-start flex-col rounded-xl border border-border/60 bg-card p-6 shadow-soft md:w-[420px]"
          >
            <header className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {r.author_photo_url ? (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                    <Image
                      src={r.author_photo_url}
                      alt={r.author_name}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <Avatar name={r.author_name} size={40} />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.author_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.rating != null && (
                      <>
                        <span className="text-accent">
                          {"★".repeat(r.rating)}
                        </span>
                        <span className="text-muted-foreground/40">
                          {"★".repeat(5 - r.rating)}
                        </span>
                      </>
                    )}
                    {r.published_at && (
                      <>
                        {r.rating != null && " · "}
                        {r.published_at.slice(0, 10)}
                      </>
                    )}
                    {r.author_role && !r.published_at && (
                      <>
                        {r.rating != null && " · "}
                        {r.author_role}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0">
                {r.source === "google" ? "Google" : "Guest"}
              </Badge>
            </header>
            <p className="mt-4 line-clamp-6 flex-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {r.body}
            </p>
            {r.rating != null && r.rating === 0 && (
              <Star className="mt-3 h-4 w-4 text-muted-foreground/40" />
            )}
          </article>
        ))}
      </div>

      {reviews.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => slideBy(-1)}
            disabled={!canPrev}
            aria-label="Previous review"
            className="absolute left-0 top-1/2 hidden -translate-y-1/2 -translate-x-1/2 rounded-full border border-border bg-card p-2 shadow-soft transition-opacity hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30 md:block"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => slideBy(1)}
            disabled={!canNext}
            aria-label="Next review"
            className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 rounded-full border border-border bg-card p-2 shadow-soft transition-opacity hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30 md:block"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
