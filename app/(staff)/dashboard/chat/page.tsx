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

const PAGE_SIZE = 50;

export default async function StaffChatIndex(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createServerClient();
  const { data, count } = await supabase
    .from("conversations")
    .select(
      "id, status, last_message_at, staff_unread_count, guest_unread_count, profiles:guest_id(id, full_name, email, phone)",
      { count: "exact" },
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);
  const rows = (data as unknown as ConvRow[] | null) ?? [];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Table-wide unread count for the header badge (independent of pagination).
  const { count: unreadCount } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .gt("staff_unread_count", 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Chat"
        description="One conversation per guest. Highlighted rows have new messages for you."
        actions={
          (unreadCount ?? 0) > 0 && <Badge variant="solid">{unreadCount} unread</Badge>
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

      {pages > 1 && <Pager page={page} pages={pages} sp={sp} />}
    </div>
  );
}

function Pager({
  page,
  pages,
  sp,
}: {
  page: number;
  pages: number;
  sp: Record<string, string | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "page") params.set(k, v);
  }
  const prev = page > 1 ? `?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page - 1) })}` : null;
  const next = page < pages ? `?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page + 1) })}` : null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span>Page {page} of {pages}</span>
      <div className="flex gap-2">
        {prev && <a href={prev} className="rounded-md border px-3 py-1.5 hover:bg-muted">← Prev</a>}
        {next && <a href={next} className="rounded-md border px-3 py-1.5 hover:bg-muted">Next →</a>}
      </div>
    </div>
  );
}
