"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_role: "guest" | "receptionist" | "manager" | "super_admin";
  body: string;
  created_at: string;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function RealtimeChat(props: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  currentProfileId: string;
  sendAction: (formData: FormData) => Promise<void>;
  emptyHint?: string;
  hiddenFields?: Record<string, string>;
  // Overrides the outer container classes. Pass when embedding inside another
  // surface (e.g. floating bubble) that already provides border / shadow.
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(props.initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!props.conversationId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`conv:${props.conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${props.conversationId}`,
        },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.some((p) => p.id === m.id) ? prev : [...prev, m],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [props.conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Group messages by day for date dividers
  const grouped: { day: string; label: string; items: ChatMessage[] }[] = [];
  for (const m of messages) {
    const day = dayKey(m.created_at);
    const last = grouped[grouped.length - 1];
    if (!last || last.day !== day) {
      grouped.push({ day, label: dayLabel(m.created_at), items: [m] });
    } else {
      last.items.push(m);
    }
  }

  return (
    <div
      className={
        props.className ??
        "flex h-[65vh] flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft"
      }
    >
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent">
              <Send className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              {props.emptyHint ?? "No messages yet."}
            </p>
          </div>
        ) : (
          <ul className="space-y-6">
            {grouped.map((g) => (
              <li key={g.day}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-px flex-1 bg-border" />
                  <span className="rounded-full bg-muted px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {g.label}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <ul className="space-y-3">
                  {g.items.map((m) => {
                    const mine = m.sender_id === props.currentProfileId;
                    const role = m.sender_role === "guest" ? "Guest" : m.sender_role.replace("_", " ");
                    return (
                      <li
                        key={m.id}
                        className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}
                      >
                        <Avatar name={role} size={28} />
                        <div
                          className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-soft ${
                            mine
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              mine ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      <form
        ref={formRef}
        action={async (fd) => {
          await props.sendAction(fd);
          formRef.current?.reset();
        }}
        className="border-t border-border/60 bg-background/60 p-3"
      >
        {props.conversationId && (
          <input type="hidden" name="conversation_id" value={props.conversationId} />
        )}
        {props.hiddenFields &&
          Object.entries(props.hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        <div className="flex items-end gap-2">
          <Textarea
            name="body"
            required
            placeholder="Type a message…"
            rows={2}
            className="flex-1 resize-none"
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
