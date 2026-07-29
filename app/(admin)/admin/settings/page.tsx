import { createServerClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusNote } from "@/components/ui/status-note";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { updateSettings } from "./actions";

export default async function AdminSettingsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();
  const { data } = await supabase.from("site_settings").select("*").single();
  const s = (data ?? {}) as Record<string, string | number | null>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Identity"
        title="Site settings"
        description="Hotel identity, contact details, and currency."
      />

      <StatusNote saved={sp.saved} error={sp.error} />

      <form action={updateSettings} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Hotel name" name="hotel_name" defaultValue={s.hotel_name as string} required />
            <Field label="Tagline" name="tagline" defaultValue={(s.tagline as string) ?? ""} />
            <FieldArea label="Address" name="address" defaultValue={(s.address as string) ?? ""} />
            <Field label="Contact phone" name="contact_phone" defaultValue={(s.contact_phone as string) ?? ""} />
            <Field label="Contact email" name="contact_email" type="email" defaultValue={(s.contact_email as string) ?? ""} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Currency &amp; locale</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Currency (ISO 4217)" name="currency" defaultValue={(s.currency as string) ?? "NPR"} required />
            <Field label="Currency symbol" name="currency_symbol" defaultValue={(s.currency_symbol as string) ?? "Rs."} required />
            <Field label="Timezone" name="timezone" defaultValue={(s.timezone as string) ?? "Asia/Kathmandu"} required />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Google Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <Field
              label="Google Place ID"
              name="google_place_id"
              defaultValue={(s.google_place_id as string) ?? ""}
              placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
            />
          </CardContent>
        </Card>

        <SubmitButton size="sm">Save</SubmitButton>
      </form>
    </div>
  );
}

function Field(props: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  step?: string;
  min?: string;
  max?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        required={props.required}
        step={props.step}
        min={props.min}
        max={props.max}
        placeholder={props.placeholder}
      />
    </div>
  );
}

function FieldArea(props: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Textarea id={props.name} name={props.name} defaultValue={props.defaultValue} />
    </div>
  );
}
