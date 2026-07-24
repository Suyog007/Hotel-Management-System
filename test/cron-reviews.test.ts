import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({ admin: null as unknown, refresh: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/google-places", () => ({ refreshGoogleReviewsCache: h.refresh }));

import { GET } from "@/app/api/cron/refresh-google-reviews/route";

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(new Request(url, { headers }));
}

function makeAdmin(settingsRow: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        single: async () => ({ data: settingsRow, error: null }),
      }),
    }),
  };
}

beforeEach(() => {
  h.refresh.mockReset();
  process.env.CRON_SECRET = "s3cr3t";
  process.env.GOOGLE_PLACES_API_KEY = "test-places-key";
});

describe("GET /api/cron/refresh-google-reviews", () => {
  it("rejects a request with no secret", async () => {
    h.admin = makeAdmin({ google_place_id: "place-1" });
    const res = await GET(req("http://localhost:4000/api/cron/refresh-google-reviews"));
    expect(res.status).toBe(401);
  });

  it("rejects a request with the wrong secret via ?secret=", async () => {
    h.admin = makeAdmin({ google_place_id: "place-1" });
    const res = await GET(req("http://localhost:4000/api/cron/refresh-google-reviews?secret=wrong"));
    expect(res.status).toBe(401);
  });

  it("rejects a request when CRON_SECRET itself is unset (fails closed, not open)", async () => {
    delete process.env.CRON_SECRET;
    h.admin = makeAdmin({ google_place_id: "place-1" });
    const res = await GET(req("http://localhost:4000/api/cron/refresh-google-reviews?secret=anything"));
    expect(res.status).toBe(401);
  });

  it("accepts the secret via the Authorization: Bearer header", async () => {
    h.admin = makeAdmin({ google_place_id: "place-1" });
    h.refresh.mockResolvedValue({ inserted: 2, updated: 1 });
    const res = await GET(
      req("http://localhost:4000/api/cron/refresh-google-reviews", { authorization: "Bearer s3cr3t" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, placeId: "place-1", inserted: 2, updated: 1 });
  });

  it("accepts the secret via ?secret= query param", async () => {
    h.admin = makeAdmin({ google_place_id: "place-1" });
    h.refresh.mockResolvedValue({ inserted: 0, updated: 0 });
    const res = await GET(req("http://localhost:4000/api/cron/refresh-google-reviews?secret=s3cr3t"));
    expect(res.status).toBe(200);
  });

  it("400s when site_settings has no google_place_id configured", async () => {
    h.admin = makeAdmin({ google_place_id: null });
    const res = await GET(
      req("http://localhost:4000/api/cron/refresh-google-reviews", { authorization: "Bearer s3cr3t" }),
    );
    expect(res.status).toBe(400);
  });

  it("500s when GOOGLE_PLACES_API_KEY is not set", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    h.admin = makeAdmin({ google_place_id: "place-1" });
    const res = await GET(
      req("http://localhost:4000/api/cron/refresh-google-reviews", { authorization: "Bearer s3cr3t" }),
    );
    expect(res.status).toBe(500);
  });

  it("500s and reports the error message when the refresh call throws", async () => {
    h.admin = makeAdmin({ google_place_id: "place-1" });
    h.refresh.mockRejectedValue(new Error("places api down"));
    const res = await GET(
      req("http://localhost:4000/api/cron/refresh-google-reviews", { authorization: "Bearer s3cr3t" }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("places api down");
  });
});
