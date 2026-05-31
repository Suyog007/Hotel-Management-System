import { describe, it, expect, afterEach } from "vitest";
import { sign, verify } from "@/lib/signed-cookie";

const ORIGINAL = process.env.SESSION_COOKIE_SECRET;

afterEach(() => {
  process.env.SESSION_COOKIE_SECRET = ORIGINAL;
});

describe("signed-cookie sign/verify", () => {
  it("round-trips an object", () => {
    const payload = { bookingId: "abc", n: 42, nested: { ok: true } };
    const token = sign(payload);
    expect(token).toContain(".");
    expect(verify<typeof payload>(token)).toEqual(payload);
  });

  it("rejects a tampered payload segment", () => {
    const token = sign({ role: "guest" });
    const [body, mac] = token.split(".");
    const forged = `${body}x.${mac}`;
    expect(verify(forged)).toBeNull();
  });

  it("rejects a tampered signature segment", () => {
    const token = sign({ role: "guest" });
    const [body] = token.split(".");
    expect(verify(`${body}.deadbeef`)).toBeNull();
  });

  it("rejects malformed / empty input", () => {
    expect(verify("")).toBeNull();
    expect(verify(undefined)).toBeNull();
    expect(verify(null)).toBeNull();
    expect(verify("no-dot-here")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    process.env.SESSION_COOKIE_SECRET = "secret-one-0123456789";
    const token = sign({ a: 1 });
    process.env.SESSION_COOKIE_SECRET = "secret-two-0123456789";
    expect(verify(token)).toBeNull();
  });

  it("throws when the secret is missing or too short", () => {
    process.env.SESSION_COOKIE_SECRET = "";
    expect(() => sign({ a: 1 })).toThrow(/SESSION_COOKIE_SECRET/);
    process.env.SESSION_COOKIE_SECRET = "tooshort";
    expect(() => sign({ a: 1 })).toThrow(/16 chars/);
  });
});
