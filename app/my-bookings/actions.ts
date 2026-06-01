"use server";

import { redirect } from "next/navigation";
import { clearGuestSession } from "@/lib/guest-session";

/** Clears the guest_session cookie. Does NOT touch the Supabase Auth session
 * — staff who book personal stays keep their normal auth login. */
export async function signOutGuest() {
  await clearGuestSession();
  redirect("/my-bookings");
}
