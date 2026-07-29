import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import { CreatePanel } from "@/components/ui/create-panel";
import { FormActions } from "@/components/ui/form-actions";
import { ManageList } from "@/components/ui/manage-list";
import { StatusNote } from "@/components/ui/status-note";
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

      <StatusNote saved={sp.saved} error={sp.error} />

      <CreatePanel title="New FAQ" description="a question guests actually ask">
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
            <div className="flex items-end gap-3">
              <Switch id="new_is_visible" name="is_visible" defaultChecked />
              <Label htmlFor="new_is_visible">Visible</Label>
            </div>
          </div>
          <FormActions>
            <SubmitButton size="sm">Add FAQ</SubmitButton>
          </FormActions>
        </form>
      </CreatePanel>

      <ManageList
        storageKey="faqs"
        noun="FAQs"
        searchPlaceholder="Search questions and answers…"
        groupAllLabel="All categories"
        emptyLabel="No FAQs yet — add common guest questions above."
        items={faqs.map((f) => ({
          id: f.id,
          title: f.question,
          subtitle: f.answer,
          meta: `#${f.sort_order}`,
          group: f.category,
          badge: f.is_visible ? null : { label: "Hidden", variant: "outline" as const },
          search: f.answer,
          children: (
            <form action={updateFaq} className="space-y-4">
              <input type="hidden" name="id" value={f.id} />
              <div className="space-y-2">
                <Label htmlFor={`q-${f.id}`}>Question</Label>
                <Input id={`q-${f.id}`} name="question" defaultValue={f.question} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`a-${f.id}`}>Answer</Label>
                <Textarea id={`a-${f.id}`} name="answer" defaultValue={f.answer} required rows={4} />
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
                <div className="flex items-end gap-3">
                  <Switch id={`v-${f.id}`} name="is_visible" defaultChecked={f.is_visible} />
                  <Label htmlFor={`v-${f.id}`}>Visible</Label>
                </div>
              </div>
              <FormActions>
                <SubmitButton size="sm">Save</SubmitButton>
                <DeleteButton
                  action={deleteFaq}
                  confirmMessage="Delete this FAQ? This can't be undone."
                  className="ml-auto"
                />
              </FormActions>
            </form>
          ),
        }))}
      />
    </div>
  );
}
