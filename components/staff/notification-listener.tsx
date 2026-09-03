"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
};

/**
 * Live wire for the back-office bell. Subscribes to Postgres changes on the
 * signed-in staff member's `notifications` rows (the table is in the
 * `supabase_realtime` publication since migration 0007) and, on each insert:
 *  - pops a toast so the event is seen even with the bell closed, and
 *  - `router.refresh()`es so the server-rendered bell/badge re-fetch.
 *
 * Mounted once per back-office layout — NOT inside the bell, which renders
 * twice (sidebar + mobile top bar) and would double everything.
 */
export function NotificationListener({ profileId }: { profileId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    // Make sure the auth token is loaded before subscribing — realtime
    // evaluates RLS with the JWT presented at subscribe time, and an
    // anonymous subscription would simply receive nothing.
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      const channel = supabase
        .channel(`notifications:${profileId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${profileId}`,
          },
          (payload) => {
            const n = payload.new as NotificationRow;
            // id-keyed so a duplicate event can't stack two toasts.
            toast(n.title, {
              id: n.id,
              description: n.body ?? undefined,
              action: n.link
                ? { label: "View", onClick: () => router.push(n.link!) }
                : undefined,
            });
            router.refresh();
          },
        )
        .subscribe();
      cleanup = () => {
        supabase.removeChannel(channel);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [profileId, router]);

  return null;
}
