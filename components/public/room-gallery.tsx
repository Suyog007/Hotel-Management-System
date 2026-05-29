"use client";

import Image from "next/image";
import { ImageLightbox } from "./image-lightbox";

/**
 * Room-detail gallery. Up to 5 thumbnails in the asymmetric layout the
 * design uses; clicking any opens the lightbox at that index.
 */
export function RoomGallery({ name, images }: { name: string; images: string[] }) {
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

  if (images.length === 1) {
    return (
      <ImageLightbox images={lightboxImages}>
        {(open) => (
          <button
            type="button"
            onClick={() => open(0)}
            className="block w-full overflow-hidden rounded-2xl"
            aria-label={`View ${name}`}
          >
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={images[0]}
                alt={name}
                fill
                sizes="(min-width: 1024px) 66vw, 100vw"
                className="rounded-2xl object-cover shadow-soft transition-transform duration-500 hover:scale-[1.02]"
                priority
              />
            </div>
          </button>
        )}
      </ImageLightbox>
    );
  }

  return (
    <ImageLightbox images={lightboxImages}>
      {(open) => (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => open(0)}
            className="col-span-2 block overflow-hidden rounded-2xl"
            aria-label={`View ${name} — image 1`}
          >
            <div className="relative aspect-[16/9] w-full">
              <Image
                src={images[0]}
                alt={name}
                fill
                sizes="(min-width: 1024px) 66vw, 100vw"
                className="rounded-2xl object-cover shadow-soft transition-transform duration-500 hover:scale-[1.02]"
                priority
              />
            </div>
          </button>
          {images.slice(1, 5).map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => open(i + 1)}
              className="block overflow-hidden rounded-xl"
              aria-label={`View ${name} — image ${i + 2}`}
            >
              <div className="relative aspect-square w-full">
                <Image
                  src={src}
                  alt={`${name} ${i + 2}`}
                  fill
                  sizes="(min-width: 1024px) 33vw, 50vw"
                  className="rounded-xl object-cover shadow-soft transition-transform duration-500 hover:scale-105"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </ImageLightbox>
  );
}
