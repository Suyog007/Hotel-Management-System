import Link from "next/link";
import { Calendar, BedDouble, LogOut } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, bookingStatusBadge, paymentStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ChatMessage } from "@/components/chat/realtime-chat";
import { FloatingChatBubble } from "@/components/chat/floating-chat-bubble";
import { sendBookingChatMessage } from "@/app/booking/[id]/chat-actions";
import { readGuestSession } from "@/lib/guest-session";
import { signOutGuest } from "./actions";

type BookingRow = {
  id: string;
  booking_code: string;
  access_token: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  status: string;
  payment_status: string;
  rooms: { room_number: string; room_types: { name: string } } | null;
};

type ResolvedGuest = {
  profileId: string;
  displayName: string;
  email: string;
  source: "session" | "cookie";
};

/**
 * Resolve the visitor to a profile via either Supabase Auth (staff who book
 * personal stays) or the guest_session cookie (anonymous guest who made a
 * booking on this device within the last 90 days). Returns null when neither
 * path resolves — the page renders a friendly fallback instead.
 */
async function resolveGuest(): Promise<ResolvedGuest | null> {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("auth_user_id", auth.user.id)
      .single();
    const p = profile as { id: string; full_name: string | null; email: string } | null;
    if (p) {
      return {
        profileId: p.id,
        displayName: p.full_name || p.email,
        email: p.email,
        source: "session",
      };
    }
  }

  const session = await readGuestSession();
  if (session) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", session.profile_id)
      .single();
    const p = profile as { id: string; full_name: string | null; email: string } | null;
    if (p) {
      return {
        profileId: p.id,
        displayName: p.full_name || p.email,
        email: p.email,
        source: "cookie",
      };
    }
  }

  return null;
}

export default async function MyBookingsPage() {
  const guest = await resolveGuest();

  if (!guest) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="container py-12 md:py-16">
          <PageHeader
            eyebrow="Your stays"
            title="My bookings"
            description="Bookings made on this device. Make a reservation and you'll see it listed here."
          />
          <EmptyState
            icon={Calendar}
            title="No bookings on this device"
            description="If you've booked before, open the link in your confirmation email or book a new room to start your list here."
            action={
              <Link href="/#rooms">
                <Button>Browse rooms</Button>
              </Link>
            }
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  // Admin client lets us read bookings + chat for cookie-based guests; auth
  // path would also work with the normal client, but admin works for both.
  const admin = createAdminClient();
  const { data: bookings } = await admin
    .from("bookings")
    .select(
      "id, booking_code, access_token, check_in, check_out, total_amount, status, payment_status, rooms:room_id(room_number, room_types:type_id(name))",
    )
    .eq("guest_id", guest.profileId)
    .order("created_at", { ascending: false });
  const rows = (bookings as unknown as BookingRow[] | null) ?? [];

  const { data: settings } = await admin
    .from("site_settings")
    .select("currency_symbol")
    .single();
  const symbol = (settings?.currency_symbol as string) ?? "Rs.";

  let chatConversationId: string | null = null;
  let chatMessages: ChatMessage[] = [];
  if (rows.length > 0) {
    const { data: convRow } = await admin
      .from("conversations")
      .select("id")
      .eq("guest_id", guest.profileId)
      .maybeSingle();
    chatConversationId = (convRow as { id: string } | null)?.id ?? null;
    if (chatConversationId) {
      const { data: msgs } = await admin
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
          eyebrow={
            guest.source === "session"
              ? `Signed in as ${guest.displayName}`
              : `Bookings for ${guest.email}`
          }
          title="My bookings"
          description="Your stays — past, present, and upcoming."
          actions={
            guest.source === "cookie" ? (
              <form action={signOutGuest}>
                <Button variant="outline" size="sm" className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Not you?
                </Button>
              </form>
            ) : undefined
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No bookings yet"
            description="Browse our rooms to make your first reservation."
            action={
              <Link href="/#rooms">
                <Button>Browse rooms</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {rows.map((b) => {
              const s = bookingStatusBadge(b.status);
              const ps = paymentStatusBadge(b.payment_status);
              return (
                <Link
                  key={b.id}
                  href={`/booking/${b.id}?t=${b.access_token}`}
                  className="block"
                >
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
          </div>
        )}
        {rows.length > 0 && (
          <FloatingChatBubble
            conversationId={chatConversationId}
            initialMessages={chatMessages}
            currentProfileId={guest.profileId}
            sendAction={sendBookingChatMessage}
            hiddenFields={{ booking_id: rows[0].id }}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
