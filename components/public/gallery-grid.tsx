"use client";

import Image from "next/image";
import { ImageLightbox } from "./image-lightbox";

type Item = {
  id: string;
  image_url: string;
  caption: string | null;
  category: string | null;
};

export function GalleryGrid({ items }: { items: Item[] }) {
  // Group by category, preserving first-seen order so admin sort_order wins.
  const groups: { category: string; items: Item[] }[] = [];
  const seen = new Map<string, Item[]>();
  for (const it of items) {
    const cat = it.category ?? "Other";
    if (!seen.has(cat)) {
      const bucket: Item[] = [];
      seen.set(cat, bucket);
      groups.push({ category: cat, items: bucket });
    }
    seen.get(cat)!.push(it);
  }

  // Build a flat list of LightboxImage in the same order as we render, so
  // clicking a thumb opens the correct index.
  const flat = items.map((it) => ({
    url: it.image_url,
    caption: it.caption ?? undefined,
  }));
  // Map item.id → flat index for O(1) lookup at click time.
  const indexById = new Map(items.map((it, i) => [it.id, i]));

  return (
    <ImageLightbox images={flat}>
      {(open) => (
        <div className="space-y-14">
          {groups.map(({ category, items: catItems }) => (
            <section key={category}>
              <h2 className="mb-5 font-display text-2xl font-semibold tracking-tight">
                {category}
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {catItems.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => open(indexById.get(g.id) ?? 0)}
                    aria-label={g.caption ?? "Photo"}
                    className="group relative aspect-square overflow-hidden rounded-xl"
                  >
                    <Image
                      src={g.image_url}
                      alt={g.caption ?? ""}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {g.caption && (
                      <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-foreground/85 to-transparent p-3 text-left text-xs text-primary-foreground transition-transform duration-300 group-hover:translate-y-0">
                        {g.caption}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </ImageLightbox>
  );
}
