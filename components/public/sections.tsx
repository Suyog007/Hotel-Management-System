import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export type PageSection = {
  id: string;
  section_type: "hero" | "text" | "gallery" | "cta" | "faq";
  content: Record<string, unknown> | null;
};

export async function PageSectionRenderer({ section }: { section: PageSection }) {
  const c = (section.content ?? {}) as Record<string, string | string[] | undefined>;
  switch (section.section_type) {
    case "hero":
      return <HeroSection c={c} />;
    case "text":
      return <TextSection c={c} />;
    case "cta":
      return <CtaSection c={c} />;
    case "gallery":
      return <GallerySection c={c} />;
    case "faq":
      return <FaqSection c={c} />;
  }
}

function HeroSection({ c }: { c: Record<string, string | string[] | undefined> }) {
  return (
    <section className="relative overflow-hidden">
      {c.image_url ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${c.image_url as string})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/70 via-foreground/40 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 bg-linen" />
      )}
      <div className="container relative py-24 md:py-32">
        <div className="max-w-2xl">
          {c.heading && (
            <h1 className={`font-display text-display-xl font-semibold ${c.image_url ? "text-primary-foreground" : ""}`}>
              {c.heading as string}
            </h1>
          )}
          {c.subheading && (
            <p className={`mt-5 text-lg ${c.image_url ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
              {c.subheading as string}
            </p>
          )}
          {c.cta_label && c.cta_href && (
            <div className="mt-8">
              <Link href={c.cta_href as string}>
                <Button size="lg" variant={c.image_url ? "accent" : "default"}>
                  {c.cta_label as string}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TextSection({ c }: { c: Record<string, string | string[] | undefined> }) {
  return (
    <section className="container py-16 md:py-20">
      <div className="mx-auto max-w-3xl">
        {c.heading && (
          <h2 className="font-display text-3xl font-semibold md:text-4xl">
            {c.heading as string}
          </h2>
        )}
        {c.body && (
          <div className="mt-5 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
            {c.body as string}
          </div>
        )}
      </div>
    </section>
  );
}

function CtaSection({ c }: { c: Record<string, string | string[] | undefined> }) {
  return (
    <section className="container py-16">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-primary/95 px-8 py-12 text-primary-foreground shadow-soft-lg md:px-12 md:py-16">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative max-w-2xl">
          {c.heading && (
            <h2 className="font-display text-3xl font-semibold md:text-4xl">{c.heading as string}</h2>
          )}
          {c.body && <p className="mt-4 text-primary-foreground/80">{c.body as string}</p>}
          {c.cta_label && c.cta_href && (
            <div className="mt-8">
              <Link href={c.cta_href as string}>
                <Button size="lg" variant="accent">
                  {c.cta_label as string}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

async function GallerySection({ c }: { c: Record<string, string | string[] | undefined> }) {
  const ids = (c.image_ids as string[] | undefined) ?? [];
  if (ids.length === 0) return null;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("gallery_images")
    .select("id, image_url, caption")
    .in("id", ids)
    .eq("is_visible", true)
    .order("sort_order");
  const images =
    (data as { id: string; image_url: string; caption: string | null }[] | null) ?? [];
  if (images.length === 0) return null;

  return (
    <section className="container py-16 md:py-20">
      {c.heading && (
        <h2 className="mb-8 font-display text-3xl font-semibold">{c.heading as string}</h2>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {images.map((img) => (
          <figure
            key={img.id}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.image_url}
              alt={img.caption ?? ""}
              className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {img.caption && (
              <figcaption className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-foreground/80 to-transparent px-3 py-3 text-xs text-primary-foreground transition-transform duration-300 group-hover:translate-y-0">
                {img.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

async function FaqSection({ c }: { c: Record<string, string | string[] | undefined> }) {
  const supabase = await createServerClient();
  let query = supabase
    .from("faqs")
    .select("id, question, answer, category")
    .eq("is_visible", true)
    .order("sort_order");
  const category = c.category as string | undefined;
  if (category) query = query.eq("category", category);
  const { data } = await query;
  const faqs =
    (data as { id: string; question: string; answer: string }[] | null) ?? [];
  if (faqs.length === 0) return null;

  return (
    <section className="container py-16 md:py-20">
      <div className="mx-auto max-w-3xl">
        {c.heading && (
          <h2 className="mb-8 font-display text-3xl font-semibold">{c.heading as string}</h2>
        )}
        <div className="space-y-3">
          {faqs.map((f) => (
            <details
              key={f.id}
              className="group rounded-xl border border-border/60 bg-card p-5 shadow-soft transition-shadow open:shadow-soft-lg"
            >
              <summary className="cursor-pointer select-none text-base font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {f.question}
                  <span
                    aria-hidden
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-card text-sm text-muted-foreground transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {f.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
