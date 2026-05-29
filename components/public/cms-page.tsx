import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PageSectionRenderer, type PageSection } from "@/components/public/sections";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

/**
 * Renders a CMS page (one of: about, contact, terms) by reading its row from
 * `pages` and its sections from `page_sections`. 404s if the page row is
 * missing or unpublished. If the page exists but has no sections, shows a
 * polite empty state — admins can add content via /admin/pages/<slug>.
 */
export async function CmsPage({ slug }: { slug: string }) {
  const supabase = await createServerClient();
  const { data: page } = await supabase
    .from("pages")
    .select("id, title, meta_description, is_published")
    .eq("slug", slug)
    .single();

  const p = page as
    | { id: string; title: string; meta_description: string | null; is_published: boolean }
    | null;
  if (!p || !p.is_published) notFound();

  const { data: rows } = await supabase
    .from("page_sections")
    .select("id, section_type, content")
    .eq("page_id", p.id)
    .eq("is_visible", true)
    .order("sort_order");
  const sections = (rows as PageSection[] | null) ?? [];

  return (
    <>
      <SiteHeader />
      <main id="main">
        {sections.length === 0 ? (
          <div className="container py-16 md:py-24">
            <PageHeader
              eyebrow="Hotel Vardani"
              title={p.title}
              description={p.meta_description ?? undefined}
            />
            <EmptyState
              icon={FileText}
              title="This page is being written"
              description="Our team is preparing the content here. In the meantime, head back home or browse our rooms."
            />
          </div>
        ) : (
          sections.map((s) => <PageSectionRenderer key={s.id} section={s} />)
        )}
      </main>
      <SiteFooter />
    </>
  );
}

export async function generateCmsMetadata(slug: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("pages")
    .select("title, meta_title, meta_description")
    .eq("slug", slug)
    .single();
  const p = data as { title: string; meta_title: string | null; meta_description: string | null } | null;
  if (!p) return {};
  return {
    title: p.meta_title || p.title,
    description: p.meta_description ?? undefined,
  };
}
