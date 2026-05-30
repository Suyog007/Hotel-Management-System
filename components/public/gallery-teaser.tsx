"use client";

import Image from "next/image";
import { ImageLightbox } from "./image-lightbox";

type Item = { id: string; image_url: string; caption: string | null };

export function GalleryTeaser({ items }: { items: Item[] }) {
  if (items.length === 0) return null;

  const images = items.map((it) => ({ url: it.image_url, caption: it.caption ?? undefined }));

  return (
    <ImageLightbox images={images}>
      {(open) => (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {items.slice(0, 6).map((g, i) => (
            <button
              key={g.id}
              type="button"
              onClick={() => open(i)}
              aria-label={g.caption ?? `Photo ${i + 1}`}
              className={`group relative overflow-hidden rounded-xl aspect-square ${
                i === 0 ? "md:col-span-2 md:row-span-2" : ""
              }`}
            >
              <Image
                src={g.image_url}
                alt={g.caption ?? ""}
                fill
                sizes={
                  i === 0
                    ? "(min-width: 768px) 66vw, 100vw"
                    : "(min-width: 768px) 33vw, 50vw"
                }
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {g.caption && (
                <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-foreground/85 to-transparent p-3 text-left text-xs text-primary-foreground transition-transform duration-300 group-hover:translate-y-0">
                  {g.caption}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </ImageLightbox>
  );
}
