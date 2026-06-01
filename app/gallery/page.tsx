import { ImageIcon } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GalleryGrid } from "@/components/public/gallery-grid";

type GalleryRow = {
  id: string;
  image_url: string;
  caption: string | null;
  category: string | null;
};

export default async function GalleryPage() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("gallery_images")
    .select("id, image_url, caption, category")
    .eq("is_visible", true)
    .order("sort_order");
  const rows = (data as GalleryRow[] | null) ?? [];

  return (
    <>
      <SiteHeader />
      <main id="main" className="container py-12 md:py-16">
        <PageHeader
          eyebrow="The property"
          title="Gallery"
          description={
            rows.length > 0
              ? `Every corner of the hotel — ${rows.length} photos. Click to enlarge.`
              : "Photos will appear here once they're added."
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="No photos yet"
            description="The team is adding photos. Check back soon."
          />
        ) : (
          <GalleryGrid items={rows} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
