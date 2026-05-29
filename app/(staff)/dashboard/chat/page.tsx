import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type ConvRow = {
  id: string;
  status: string;
  last_message_at: string | null;
  staff_unread_count: number;
  guest_unread_count: number;
  profiles: { id: string; full_name: string; email: string | null; phone: string | null } | null;
};

export default async function StaffChatIndex() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("conversations")
    .select(
      "id, status, last_message_at, staff_unread_count, guest_unread_count, profiles:guest_id(id, full_name, email, phone)",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });
  const rows = (data as unknown as ConvRow[] | null) ?? [];
  const unreadCount = rows.filter((r) => r.staff_unread_count > 0).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Chat"
        description="One conversation per guest. Highlighted rows have new messages for you."
        actions={
          unreadCount > 0 && <Badge variant="solid">{unreadCount} unread</Badge>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No conversations yet"
          description="When guests message reception, they'll show up here."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Link key={c.id} href={`/dashboard/chat/${c.id}`} className="block">
              <Card
                className={`transition-all hover:-translate-y-0.5 hover:shadow-soft-lg ${
                  c.staff_unread_count > 0
                    ? "border-accent/40 bg-accent/5"
                    : ""
                }`}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <Avatar name={c.profiles?.full_name ?? "Guest"} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{c.profiles?.full_name ?? "Guest"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.profiles?.email ?? ""}{" "}
                      {c.profiles?.phone ? `· ${c.profiles.phone}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    {c.staff_unread_count > 0 ? (
                      <Badge variant="solid">{c.staff_unread_count} new</Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {c.last_message_at
                          ? c.last_message_at.replace("T", " ").slice(0, 16)
                          : "—"}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
