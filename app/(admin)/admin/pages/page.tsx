import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

type PageRow = {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  is_published: boolean;
};

export default async function AdminPagesIndex() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("pages")
    .select("id, slug, title, meta_description, is_published")
    .order("slug");
  const pages = (data as PageRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Site content"
        title="Pages"
        description="The four top-level pages are fixed (home, about, contact, terms). Edit meta and sections inside each."
      />

      <div className="space-y-3">
        {pages.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-display">{p.title}</CardTitle>
                <p className="mt-1 font-mono text-xs text-muted-foreground">/{p.slug === "home" ? "" : p.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={p.is_published ? "success" : "outline"}>
                  {p.is_published ? "Published" : "Draft"}
                </Badge>
                <Link
                  href={`/admin/pages/${p.slug}`}
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  Edit →
                </Link>
              </div>
            </CardHeader>
            {p.meta_description && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{p.meta_description}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
