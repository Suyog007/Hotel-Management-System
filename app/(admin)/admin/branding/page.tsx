import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { updateBranding } from "./actions";

export default async function AdminBrandingPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase.from("branding").select("*").single();
  const b = (data ?? {}) as Record<string, string | null>;

  const primary = (b.primary_color as string) ?? "#1e3c72";
  const secondary = (b.secondary_color as string) ?? "#2a5298";
  const accent = (b.accent_color as string) ?? "#f59e0b";
  const fontFamily = (b.font_family as string) ?? "Inter, system-ui, sans-serif";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Look & feel"
        title="Branding"
        description="Colors and font you'd like associated with the property."
      />

      <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning-foreground">
        <strong>Heads up:</strong> the public site currently ships a hand-tuned
        boutique palette (terracotta + sand + copper). Edits here are saved
        for future use but don&apos;t override the rendered theme. The fonts
        (Playfair Display + Inter) are likewise fixed at the design level.
      </div>

      {sp.saved && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
          Saved.
        </div>
      )}
      {sp.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {sp.error}
        </div>
      )}

      <form action={updateBranding} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Colors</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ColorField name="primary_color" label="Primary" value={primary} />
            <ColorField name="secondary_color" label="Secondary" value={secondary} />
            <ColorField name="accent_color" label="Accent" value={accent} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="font_family">Font family</Label>
              <Input
                id="font_family"
                name="font_family"
                defaultValue={fontFamily}
                placeholder="Inter, system-ui, sans-serif"
                required
              />
              <p className="text-xs text-muted-foreground">
                Use a CSS font-family value. Web fonts must be loaded separately.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit">Save</Button>
      </form>
    </div>
  );
}

function ColorField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-10 w-12 rounded-md border"
          style={{ backgroundColor: value }}
        />
        <Input
          id={name}
          name={name}
          defaultValue={value}
          pattern="^#[0-9a-fA-F]{6}$"
          required
          className="font-mono"
        />
      </div>
    </div>
  );
}
