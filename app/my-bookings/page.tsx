import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, BedDouble } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, bookingStatusBadge, paymentStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RealtimeChat, type ChatMessage } from "@/components/chat/realtime-chat";
import { sendBookingChatMessage } from "@/app/booking/[id]/chat-actions";

type BookingRow = {
  id: string;
  booking_code: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  status: string;
  payment_status: string;
  rooms: { room_number: string; room_types: { name: string } } | null;
};

export default async function MyBookingsPage() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/my-bookings`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("auth_user_id", auth.user.id)
    .single();
  const p = profile as { id: string; full_name: string } | null;
  if (!p) redirect("/");

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, check_in, check_out, total_amount, status, payment_status, rooms:room_id(room_number, room_types:type_id(name))",
    )
    .eq("guest_id", p.id)
    .order("created_at", { ascending: false });
  const rows = (bookings as unknown as BookingRow[] | null) ?? [];

  const { data: settings } = await supabase
    .from("site_settings")
    .select("currency_symbol")
    .single();
  const symbol = (settings?.currency_symbol as string) ?? "Rs.";

  // One chat panel for the guest, shared across all their bookings (conversation
  // is keyed on guest_id, not booking_id). Only render if they have at least
  // one booking — chat needs a booking_id to authorize against the action.
  let chatConversationId: string | null = null;
  let chatMessages: ChatMessage[] = [];
  if (rows.length > 0) {
    const { data: convRow } = await supabase
      .from("conversations")
      .select("id")
      .eq("guest_id", p.id)
      .maybeSingle();
    chatConversationId = (convRow as { id: string } | null)?.id ?? null;
    if (chatConversationId) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, sender_role, body, created_at")
        .eq("conversation_id", chatConversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      chatMessages = (msgs as ChatMessage[] | null) ?? [];
    }
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="container py-12 md:py-16">
        <PageHeader
          eyebrow={`Signed in as ${p.full_name}`}
          title="My bookings"
          description="Your stays — past, present, and upcoming."
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No bookings yet"
            description="Browse our rooms to make your first reservation."
            action={
              <Link href="/rooms">
                <Button>Browse rooms</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-10">
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">
                  Chat with reception
                </h2>
                <span className="text-xs text-muted-foreground">
                  {chatMessages.length > 0
                    ? `${chatMessages.length} message${chatMessages.length === 1 ? "" : "s"}`
                    : "New conversation"}
                </span>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                One thread for all your bookings. Reception typically replies within
                a few minutes during the day.
              </p>
              <RealtimeChat
                conversationId={chatConversationId}
                initialMessages={chatMessages}
                currentProfileId={p.id}
                sendAction={sendBookingChatMessage}
                hiddenFields={{ booking_id: rows[0].id }}
                emptyHint="Say hi — front desk is here to help."
              />
            </section>

            <section className="space-y-4">
            {rows.map((b) => {
              const s = bookingStatusBadge(b.status);
              const ps = paymentStatusBadge(b.payment_status);
              return (
                <Link key={b.id} href={`/booking/${b.id}`} className="block">
                  <article className="flex flex-wrap items-center gap-6 rounded-xl border border-border/60 bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg">
                    <div className="hidden h-14 w-14 shrink-0 place-items-center rounded-md bg-accent/10 text-accent sm:grid">
                      <BedDouble className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-mono text-xs text-muted-foreground">{b.booking_code}</p>
                      <p className="mt-0.5 font-display text-lg font-semibold">
                        {b.rooms?.room_types.name ?? "—"}{" "}
                        <span className="font-normal text-muted-foreground">#{b.rooms?.room_number ?? "—"}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {b.check_in} → {b.check_out}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={s.variant}>{s.label}</Badge>
                      <Badge variant={ps.variant}>{ps.label}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-semibold">
                        {symbol} {Number(b.total_amount).toLocaleString()}
                      </p>
                    </div>
                  </article>
                </Link>
              );
            })}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
