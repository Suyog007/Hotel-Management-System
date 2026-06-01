"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { RealtimeChat, type ChatMessage } from "./realtime-chat";

/**
 * Bottom-right floating chat button. Click to open a compact chat panel,
 * click X (or press Escape) to close. Same RealtimeChat under the hood —
 * the bubble is just a presentation shell.
 */
export function FloatingChatBubble(props: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  currentProfileId: string;
  sendAction: (formData: FormData) => Promise<void>;
  hiddenFields?: Record<string, string>;
  /** Show a small dot on the bubble when there are unread messages. */
  hasUnread?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        aria-label={open ? "Close chat" : "Open chat with reception"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 left-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft-lg transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:left-6"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
            {props.hasUnread && (
              <span
                aria-hidden
                className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-primary bg-accent"
              />
            )}
          </>
        )}
      </button>

      {/* Slide-in chat panel */}
      {open && (
        <div className="fixed bottom-24 left-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-soft-lg md:left-6 md:max-w-md">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Chat with reception</p>
              <p className="text-xs text-muted-foreground">
                Typically replies within a few minutes
              </p>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <RealtimeChat
            conversationId={props.conversationId}
            initialMessages={props.initialMessages}
            currentProfileId={props.currentProfileId}
            sendAction={props.sendAction}
            hiddenFields={props.hiddenFields}
            emptyHint="Say hi — front desk is here to help."
            className="flex h-[480px] flex-col"
          />
        </div>
      )}
    </>
  );
}
