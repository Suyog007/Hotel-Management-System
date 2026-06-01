import "server-only";
import { cookies } from "next/headers";
import { sign, verify } from "@/lib/signed-cookie";

export const GUEST_SESSION_COOKIE = "guest_session";
const TTL_DAYS = 90;
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

export type GuestSession = {
  profile_id: string;
  email: string;
  set_at: number;
};

/** Stamp the device with a long-lived signed cookie so the guest can revisit
 * /my-bookings without logging in. Same HMAC scheme as the booking intent
 * cookie — forgery requires SESSION_COOKIE_SECRET. */
export async function setGuestSession(profile_id: string, email: string) {
  const payload: GuestSession = {
    profile_id,
    email: email.toLowerCase(),
    set_at: Date.now(),
  };
  const store = await cookies();
  store.set(GUEST_SESSION_COOKIE, sign(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function readGuestSession(): Promise<GuestSession | null> {
  const store = await cookies();
  const raw = store.get(GUEST_SESSION_COOKIE)?.value;
  const data = verify<GuestSession>(raw);
  if (!data || !data.profile_id || !data.email) return null;
  return data;
}

export async function clearGuestSession() {
  const store = await cookies();
  store.delete(GUEST_SESSION_COOKIE);
}
