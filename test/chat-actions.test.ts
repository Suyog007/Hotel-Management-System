import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./stubs/fake-supabase";
import { makeRedirect, expectRedirectTo } from "./stubs/next-test-helpers";

const h = vi.hoisted(() => ({ server: null as unknown, admin: null as unknown }));
vi.mock("next/navigation", () => ({ redirect: makeRedirect() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.server }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));

import { sendStaffMessage } from "@/app/(staff)/dashboard/chat/actions";
import { sendBookingChatMessage } from "@/app/booking/[id]/chat-actions";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const CONVO_ID = "11111111-1111-1111-1111-111111111111";
const BOOKING_ID = "22222222-2222-2222-2222-222222222222";
const GUEST_ID = "33333333-3333-3333-3333-333333333333";
const STAFF_PROFILE_ID = "44444444-4444-4444-4444-444444444444";
const TOKEN = "55555555-5555-5555-5555-555555555555";

describe("sendStaffMessage", () => {
  function seed(opts: { user?: { id: string } | null; role?: string } = {}) {
    h.server = createFakeSupabase(
      { profiles: [{ id: STAFF_PROFILE_ID, auth_user_id: "auth-1", role: opts.role ?? "receptionist" }], messages: [] },
      { user: opts.user === null ? null : { id: "auth-1" } },
    );
    return h.server as ReturnType<typeof createFakeSupabase>;
  }

  it("redirects to /login when unauthenticated", async () => {
    seed({ user: null });
    const url = await expectRedirectTo(() => sendStaffMessage(form({ conversation_id: CONVO_ID, body: "hi" })));
    expect(url).toBe("/login?next=/dashboard/chat");
  });

  it("rejects a guest (non-staff) session", async () => {
    seed({ role: "guest" });
    const url = await expectRedirectTo(() => sendStaffMessage(form({ conversation_id: CONVO_ID, body: "hi" })));
    expect(url).toMatch(/^\/\?error=Staff/);
  });

  it("redirects with an error when conversation_id is missing", async () => {
    seed({});
    const url = await expectRedirectTo(() => sendStaffMessage(form({ body: "hi" })));
    expect(url).toMatch(/Missing.*conversation/i);
  });

  it("silently no-ops on an empty message body", async () => {
    seed({});
    const url = await expectRedirectTo(() => sendStaffMessage(form({ conversation_id: CONVO_ID, body: "   " })));
    expect(url).toBe(`/dashboard/chat/${CONVO_ID}`);
  });

  it("rejects a message longer than 4000 chars", async () => {
    seed({});
    const url = await expectRedirectTo(() =>
      sendStaffMessage(form({ conversation_id: CONVO_ID, body: "x".repeat(4001) })),
    );
    expect(url).toMatch(/too.*long/i);
  });

  it("inserts the message with the staff sender's id and role", async () => {
    const server = seed({ role: "manager" });
    await sendStaffMessage(form({ conversation_id: CONVO_ID, body: "On our way" }));
    expect(server.__tables.messages).toHaveLength(1);
    expect(server.__tables.messages[0]).toMatchObject({
      conversation_id: CONVO_ID,
      sender_id: STAFF_PROFILE_ID,
      sender_role: "manager",
      body: "On our way",
    });
  });
});

describe("sendBookingChatMessage", () => {
  function seed(opts: {
    booking?: Record<string, unknown> | null;
    conversations?: Record<string, unknown>[];
    serverUser?: { id: string } | null;
    serverProfile?: Record<string, unknown>;
  } = {}) {
    h.admin = createFakeSupabase({
      bookings: opts.booking === null ? [] : [{ id: BOOKING_ID, guest_id: GUEST_ID, access_token: TOKEN, ...opts.booking }],
      conversations: opts.conversations ?? [],
      messages: [],
    });
    h.server = createFakeSupabase(
      { profiles: opts.serverProfile ? [opts.serverProfile] : [] },
      { user: opts.serverUser ?? null },
    );
    return h.admin as ReturnType<typeof createFakeSupabase>;
  }

  it("redirects when the booking id isn't a uuid", async () => {
    seed();
    const url = await expectRedirectTo(() => sendBookingChatMessage(form({ booking_id: "nope", body: "hi" })));
    expect(url).toMatch(/^\/\?error=Invalid/);
  });

  it("no-ops on an empty body, redirecting back to the booking page", async () => {
    seed();
    const url = await expectRedirectTo(() =>
      sendBookingChatMessage(form({ booking_id: BOOKING_ID, access_token: TOKEN, body: "  " })),
    );
    expect(url).toBe(`/booking/${BOOKING_ID}?t=${TOKEN}`);
  });

  it("rejects a body over 4000 chars", async () => {
    seed();
    const url = await expectRedirectTo(() =>
      sendBookingChatMessage(form({ booking_id: BOOKING_ID, access_token: TOKEN, body: "x".repeat(4001) })),
    );
    expect(url).toMatch(/chat_error/);
  });

  it("redirects when the booking doesn't exist", async () => {
    seed({ booking: null });
    const url = await expectRedirectTo(() =>
      sendBookingChatMessage(form({ booking_id: BOOKING_ID, access_token: TOKEN, body: "hi" })),
    );
    expect(url).toMatch(/^\/\?error=Booking/);
  });

  it("rejects an unauthenticated request with no matching access_token", async () => {
    seed();
    const url = await expectRedirectTo(() =>
      sendBookingChatMessage(form({ booking_id: BOOKING_ID, access_token: "wrong-token", body: "hi" })),
    );
    expect(url).toMatch(/Not%20authorized/);
  });

  it("accepts a matching access_token, creates a conversation, and sends as the guest", async () => {
    const admin = seed();
    await sendBookingChatMessage(form({ booking_id: BOOKING_ID, access_token: TOKEN, body: "Hi there" }));
    expect(admin.__tables.conversations).toHaveLength(1);
    expect(admin.__tables.conversations[0]).toMatchObject({ guest_id: GUEST_ID });
    expect(admin.__tables.messages[0]).toMatchObject({ sender_id: GUEST_ID, sender_role: "guest", body: "Hi there" });
  });

  it("reuses an existing conversation instead of creating a duplicate", async () => {
    const admin = seed({ conversations: [{ id: CONVO_ID, guest_id: GUEST_ID }] });
    await sendBookingChatMessage(form({ booking_id: BOOKING_ID, access_token: TOKEN, body: "Hi again" }));
    expect(admin.__tables.conversations).toHaveLength(1);
    expect(admin.__tables.messages[0]).toMatchObject({ conversation_id: CONVO_ID });
  });

  it("lets the signed-in guest owner send without a token", async () => {
    const admin = seed({
      serverUser: { id: "auth-guest" },
      serverProfile: { id: GUEST_ID, auth_user_id: "auth-guest", role: "guest" },
    });
    await sendBookingChatMessage(form({ booking_id: BOOKING_ID, body: "It's me" }));
    expect(admin.__tables.messages[0]).toMatchObject({ sender_id: GUEST_ID, sender_role: "guest" });
  });

  it("lets signed-in staff reply on the guest's behalf, tagged with the staff sender", async () => {
    const admin = seed({
      serverUser: { id: "auth-staff" },
      serverProfile: { id: STAFF_PROFILE_ID, auth_user_id: "auth-staff", role: "receptionist" },
    });
    await sendBookingChatMessage(form({ booking_id: BOOKING_ID, body: "We got your message" }));
    expect(admin.__tables.messages[0]).toMatchObject({ sender_id: STAFF_PROFILE_ID, sender_role: "receptionist" });
  });

  it("rejects a signed-in guest who doesn't own the booking and has no token", async () => {
    seed({
      serverUser: { id: "auth-other" },
      serverProfile: { id: "some-other-guest", auth_user_id: "auth-other", role: "guest" },
    });
    const url = await expectRedirectTo(() => sendBookingChatMessage(form({ booking_id: BOOKING_ID, body: "sneaky" })));
    expect(url).toMatch(/Not%20authorized/);
  });
});
