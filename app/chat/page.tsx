import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteHeader } from "@/components/public/site-header";
import { PageHeader } from "@/components/ui/page-header";
import { RealtimeChat, type ChatMessage } from "@/components/chat/realtime-chat";
import { sendGuestMessage } from "./actions";

export default async function GuestChatPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/chat");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("auth_user_id", auth.user.id)
    .single();
  const p = profile as { id: string; full_name: string } | null;
  if (!p) redirect("/");

  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("guest_id", p.id)
    .maybeSingle();
  const conversationId = (conv as { id: string } | null)?.id ?? null;

  let messages: ChatMessage[] = [];
  if (conversationId) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, sender_role, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    messages = (msgs as ChatMessage[] | null) ?? [];

    const admin = createAdminClient();
    await admin
      .from("conversations")
      .update({ guest_unread_count: 0 })
      .eq("id", conversationId);

    await admin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_role", "guest")
      .is("read_at", null);
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="container max-w-3xl py-8 md:py-12">
        <PageHeader
          eyebrow={`Signed in as ${p.full_name}`}
          title="Chat with reception"
          description="We typically reply within a few minutes during reception hours."
        />

        {sp.error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {sp.error}
          </div>
        )}

        <RealtimeChat
          conversationId={conversationId}
          initialMessages={messages}
          currentProfileId={p.id}
          sendAction={sendGuestMessage}
          emptyHint="Say hi — our front desk team is here to help."
        />
      </main>
    </>
  );
}
