"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead } from "./notification-actions";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read_at).length;

  // Close when clicking anywhere outside the bell.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 font-mono text-[10px] font-bold leading-none text-danger-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-md border border-foreground/10 bg-card shadow-soft-lg">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <form action={markAllNotificationsRead}>
                <button
                  type="submit"
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              </form>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing right now.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-border/60 overflow-y-auto">
              {items.map((n) => {
                const inner = (
                  <>
                    <span className="flex items-start justify-between gap-2">
                      <span className={cn("text-sm", n.read_at ? "font-normal" : "font-semibold")}>
                        {n.title}
                      </span>
                      {!n.read_at && (
                        <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-danger" />
                      )}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{n.body}</span>
                    )}
                    <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {timeAgo(n.created_at)}
                    </span>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => setOpen(false)}
                        className="flex flex-col px-4 py-3 transition-colors hover:bg-muted/60"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <span className="flex flex-col px-4 py-3">{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
