import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/ui/avatar";
import { RealtimeChat, type ChatMessage } from "@/components/chat/realtime-chat";
import { sendStaffMessage } from "../actions";

type ConvDetail = {
  id: string;
  status: string;
  last_message_at: string | null;
  profiles: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

export default async function StaffChatConversation(props: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await props.params;
  const supabase = await createServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/dashboard/chat/${conversationId}`);

  const { data: actor } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", auth.user.id)
    .single();
  const a = actor as { id: string; role: string } | null;
  if (!a) redirect("/");

  const { data: conv } = await supabase
    .from("conversations")
    .select(
      "id, status, last_message_at, profiles:guest_id(id, full_name, email, phone)",
    )
    .eq("id", conversationId)
    .single();
  if (!conv) notFound();
  const c = conv as unknown as ConvDetail;

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, sender_role, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  const messages = (msgs as ChatMessage[] | null) ?? [];

  const admin = createAdminClient();
  await admin
    .from("conversations")
    .update({ staff_unread_count: 0 })
    .eq("id", conversationId);
  await admin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("sender_role", "guest")
    .is("read_at", null);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/dashboard/chat"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Inbox
      </Link>

      <header className="flex items-center gap-3">
        <Avatar name={c.profiles?.full_name ?? "Guest"} size={48} />
        <div>
          <p className="font-display text-2xl font-semibold leading-tight">
            {c.profiles?.full_name ?? "Guest"}
          </p>
          <p className="text-xs text-muted-foreground">
            {c.profiles?.email ?? ""}{" "}
            {c.profiles?.phone ? `· ${c.profiles.phone}` : ""}
          </p>
        </div>
      </header>

      <RealtimeChat
        conversationId={conversationId}
        initialMessages={messages}
        currentProfileId={a.id}
        sendAction={sendStaffMessage}
      />
    </div>
  );
}
