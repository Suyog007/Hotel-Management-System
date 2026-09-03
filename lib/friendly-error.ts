/**
 * Log the raw DB/internal error server-side and hand back a generic message
 * safe to place in a `?error=` query param. Raw Postgres/Supabase text must
 * never reach the browser — it leaks schema details into the address bar and
 * the user's history, and it's useless to the person reading it anyway.
 *
 * Zod validation messages are NOT routed through this — those are written for
 * humans and stay verbatim.
 */
export function friendlyDbError(
  error: { message?: string | null } | string | null | undefined,
  fallback = "Couldn't save your changes. Please try again.",
): string {
  const raw = typeof error === "string" ? error : error?.message;
  if (raw) console.error("[action]", raw);
  return fallback;
}
