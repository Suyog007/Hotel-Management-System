// Global test setup. Provides the env vars that pure modules read at runtime
// so they don't throw on import/use. No real secrets — these are test-only.
import ws from "ws";

if (!process.env.SESSION_COOKIE_SECRET) {
  process.env.SESSION_COOKIE_SECRET = "test-secret-0123456789-abcdef"; // >= 16 chars
}

// Node < 22 has no global WebSocket; supabase-js eagerly inits a realtime
// client that needs one. Only relevant to the DB integration suites.
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
