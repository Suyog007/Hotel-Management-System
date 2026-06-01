import { describe, it, expect } from "vitest";
import {
  roomTypeSchema,
  roomSchema,
  bookingFormSchema,
} from "@/lib/validation/rooms";
import { emailSchema, verifyOtpSchema } from "@/lib/validation/auth";
import {
  parseSectionContent,
  defaultSectionContent,
  galleryContent,
  pageMetaSchema,
} from "@/lib/validation/sections";

const UUID = "11111111-1111-1111-1111-111111111111";

// Far-future so the "today or later" refinement always passes regardless of run date.
const FUTURE_IN = "2999-01-01";
const FUTURE_OUT = "2999-01-04";

describe("bookingFormSchema", () => {
  const base = {
    room_type_id: UUID,
    check_in: FUTURE_IN,
    check_out: FUTURE_OUT,
    guests_count: "2",
    guest_name: "Jane Doe",
    guest_email: "JANE@example.com",
    guest_phone: "+9779812345678",
    payment_method: "pay_at_hotel",
  };

  it("accepts a valid booking and coerces/normalizes", () => {
    const r = bookingFormSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.guests_count).toBe(2); // coerced number
      expect(r.data.guest_email).toBe("jane@example.com"); // lowercased
    }
  });

  it("rejects check-out on or before check-in", () => {
    const r = bookingFormSchema.safeParse({ ...base, check_out: FUTURE_IN });
    expect(r.success).toBe(false);
  });

  it("rejects a check-in in the past", () => {
    const r = bookingFormSchema.safeParse({ ...base, check_in: "2000-01-01", check_out: "2000-01-03" });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const r = bookingFormSchema.safeParse({ ...base, guest_email: "nope" });
    expect(r.success).toBe(false);
  });

  it("rejects a bad phone number", () => {
    const r = bookingFormSchema.safeParse({ ...base, guest_phone: "abc" });
    expect(r.success).toBe(false);
  });

  it("rejects an out-of-range guest count", () => {
    expect(bookingFormSchema.safeParse({ ...base, guests_count: "0" }).success).toBe(false);
    expect(bookingFormSchema.safeParse({ ...base, guests_count: "99" }).success).toBe(false);
  });

  it("rejects an unknown payment method", () => {
    const r = bookingFormSchema.safeParse({ ...base, payment_method: "bitcoin" });
    expect(r.success).toBe(false);
  });
});

describe("roomTypeSchema", () => {
  it("parses amenities from a newline/comma list and dedupes", () => {
    const r = roomTypeSchema.safeParse({
      name: "Deluxe",
      base_price: "150",
      max_guests: "2",
      amenities: "wifi\nAC, wifi\n TV ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amenities).toEqual(["wifi", "AC", "TV"]);
      expect(r.data.base_price).toBe(150);
    }
  });

  it("rejects an invalid slug", () => {
    const r = roomTypeSchema.safeParse({
      name: "Deluxe",
      slug: "Not A Slug",
      base_price: "150",
      max_guests: "2",
    });
    expect(r.success).toBe(false);
  });

  it("treats an empty slug as undefined (auto-generated downstream)", () => {
    const r = roomTypeSchema.safeParse({
      name: "Deluxe",
      slug: "",
      base_price: "150",
      max_guests: "2",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.slug).toBeUndefined();
  });

  it("rejects a negative price", () => {
    const r = roomTypeSchema.safeParse({
      name: "Deluxe",
      base_price: "-1",
      max_guests: "2",
    });
    expect(r.success).toBe(false);
  });
});

describe("roomSchema", () => {
  it("accepts a valid room and defaults status", () => {
    const r = roomSchema.safeParse({ room_number: "101", type_id: UUID });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("available");
  });

  it("coerces an empty floor to undefined", () => {
    const r = roomSchema.safeParse({ room_number: "101", type_id: UUID, floor: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.floor).toBeUndefined();
  });

  it("rejects a non-uuid type_id", () => {
    expect(roomSchema.safeParse({ room_number: "101", type_id: "x" }).success).toBe(false);
  });
});

describe("auth schemas", () => {
  it("normalizes email", () => {
    const r = emailSchema.safeParse({ email: "  USER@Example.COM " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("user@example.com");
  });

  it("accepts a 6-digit OTP token and rejects others", () => {
    expect(verifyOtpSchema.safeParse({ email: "a@b.com", token: "123456" }).success).toBe(true);
    expect(verifyOtpSchema.safeParse({ email: "a@b.com", token: "12345" }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ email: "a@b.com", token: "abcdef" }).success).toBe(false);
  });
});

describe("section content", () => {
  it("parses hero content and ignores extras", () => {
    const parsed = parseSectionContent("hero", { heading: "Welcome" });
    expect(parsed).toMatchObject({ heading: "Welcome" });
  });

  it("provides sane defaults per section type", () => {
    expect(defaultSectionContent("gallery")).toEqual({ heading: "", image_ids: [] });
    expect(defaultSectionContent("text")).toEqual({ heading: "", body: "" });
  });

  it("validates gallery image_ids as uuids", () => {
    expect(galleryContent.safeParse({ image_ids: [UUID] }).success).toBe(true);
    expect(galleryContent.safeParse({ image_ids: ["not-a-uuid"] }).success).toBe(false);
  });

  it("requires a page title", () => {
    expect(pageMetaSchema.safeParse({ title: "" }).success).toBe(false);
    expect(pageMetaSchema.safeParse({ title: "Home" }).success).toBe(true);
  });
});
