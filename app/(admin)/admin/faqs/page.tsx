import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCircle } from "lucide-react";
import { createFaq, deleteFaq, updateFaq } from "./actions";

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  is_visible: boolean;
};

export default async function AdminFaqsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("faqs")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const faqs = (data as FaqRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Public content"
        title="FAQs"
        description="Questions and answers shown to guests on the public site."
      />

      {sp.saved && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          Saved.
        </div>
      )}
      {sp.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {sp.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New FAQ</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createFaq} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_question">Question</Label>
              <Input id="new_question" name="question" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_answer">Answer</Label>
              <Textarea id="new_answer" name="answer" required />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="new_category">Category</Label>
                <Input id="new_category" name="category" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_sort_order">Order</Label>
                <Input id="new_sort_order" name="sort_order" type="number" min="0" defaultValue="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_is_visible">Visible</Label>
                <Switch id="new_is_visible" name="is_visible" defaultChecked />
              </div>
            </div>
            <Button type="submit">Add FAQ</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {faqs.length === 0 && (
          <EmptyState
            icon={HelpCircle}
            title="No FAQs yet"
            description="Add common guest questions and answers above. They'll appear on the public site grouped by category."
          />
        )}
        {faqs.map((f) => (
          <Card key={f.id}>
            <CardContent className="pt-6">
              <form action={updateFaq} className="space-y-4">
                <input type="hidden" name="id" value={f.id} />
                <div className="space-y-2">
                  <Label htmlFor={`q-${f.id}`}>Question</Label>
                  <Input id={`q-${f.id}`} name="question" defaultValue={f.question} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`a-${f.id}`}>Answer</Label>
                  <Textarea id={`a-${f.id}`} name="answer" defaultValue={f.answer} required />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`c-${f.id}`}>Category</Label>
                    <Input id={`c-${f.id}`} name="category" defaultValue={f.category ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`o-${f.id}`}>Order</Label>
                    <Input id={`o-${f.id}`} name="sort_order" type="number" min="0" defaultValue={f.sort_order} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`v-${f.id}`}>Visible</Label>
                    <Switch id={`v-${f.id}`} name="is_visible" defaultChecked={f.is_visible} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Save</Button>
                </div>
              </form>

              <form action={deleteFaq} className="mt-2">
                <input type="hidden" name="id" value={f.id} />
                <Button type="submit" variant="destructive" size="sm">
                  Delete
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
