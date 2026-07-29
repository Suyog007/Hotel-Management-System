-- Drop the in-app guest ↔ reception chat.
--
-- Superseded by the floating WhatsApp button (components/public/floating-whatsapp.tsx).
-- The application code was deleted on 2026-07-29 — nothing reads these objects.
--
-- DESTRUCTIVE: permanently deletes every stored conversation and message.
-- Export them first if you want to keep a record.
--
-- Run as the database owner (Supabase dashboard → SQL editor). The
-- service-role key does data only and cannot execute DDL.

-- `cascade` on the two tables also takes care of: the messages→conversations
-- FK, the messages_conversation_idx index, the messages_after_insert and
-- conversations_set_updated_at triggers, every RLS policy on both tables
-- (0002), and their table grants (0012). Dropping a table also removes it
-- from the supabase_realtime publication, so 0007 needs no counterpart here —
-- `notifications` stays published.
drop table if exists messages cascade;
drop table if exists conversations cascade;

-- Unreferenced once its trigger went with `messages`. Note that
-- set_updated_at() is shared with other tables and must stay.
drop function if exists on_new_message();

-- Only ever typed conversations.status.
drop type if exists conversation_status;

-- Seeded in 0003 for chat-reply notifications; no sender left.
delete from notification_templates where key = 'chat_new_message';
