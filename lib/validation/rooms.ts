import { z } from "zod";
import { hotelToday } from "@/lib/hotel-time";

// FormData.get() yields null for a field the form doesn't render, and zod's
// .optional() accepts undefined but NOT null — so a form that simply omits an
// optional input fails with "Expected string, received null". Treat an absent
// field and a blank one the same way.
const optionalText = z.preprocess(
  (v) => (v === null ? undefined : v),
  z
    .string()
    .trim()
    .max(5000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
);

// Parses a newline- or comma-separated string into a deduped string array.
function multilineToArray(input: unknown): string[] {
  if (Array.isArray(input)) return input as string[];
  if (typeof input !== "string") return [];
  return [
    ...new Set(
      input
        .split(/[\r\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

export const roomTypeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9-]*$/, "Slug must be lowercase letters, digits, or hyphens")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  description: optionalText,
  base_price: z.coerce.number().min(0).max(1_000_000),
  // Display-only "was" price. Blank means no offer running.
  original_price: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(0).max(1_000_000).optional(),
  ),
  max_guests: z.coerce.number().int().min(1).max(20),
  amenities: z.preprocess(multilineToArray, z.array(z.string().min(1)).default([])),
  images: z.preprocess(multilineToArray, z.array(z.string().min(1)).default([])),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
}).refine(
  (d) => d.original_price === undefined || d.original_price > d.base_price,
  {
    path: ["original_price"],
    message: "Original price must be higher than the base price",
  },
);

export const roomSchema = z.object({
  id: z.string().uuid().optional(),
  room_number: z.string().trim().min(1).max(40),
  type_id: z.string().uuid(),
  floor: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().int().min(-5).max(100).optional(),
  ),
  status: z.enum(["available", "occupied", "maintenance", "cleaning"]).default("available"),
  notes: optionalText,
});

const today = () => hotelToday();

export const bookingFormSchema = z
  .object({
    room_type_id: z.string().uuid(),
    check_in: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Check-in must be a date")
      .refine((v) => v >= today(), "Check-in must be today or later"),
    check_out: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Check-out must be a date"),
    guests_count: z.coerce.number().int().min(1).max(20),
    guest_name: z.string().trim().min(2).max(120),
    guest_email: z.string().trim().toLowerCase().email().max(320),
    guest_phone: z
      .string()
      .trim()
      .min(7)
      .max(32)
      .regex(/^[+\d][\d\s\-()]+$/, "Enter a valid phone number"),
    // v1 is pay-at-hotel only; the "Pay online" UI control is disabled and the
    // form submits a fixed value. Locked to a literal so a crafted request can't
    // create an unpayable `pending` booking. Restore the enum when online pay ships.
    payment_method: z.literal("pay_at_hotel"),
    special_requests: optionalText,
    // Optional AC upgrade (Standard rooms only; re-validated server-side).
    ac_addon: z.boolean().default(false),
  })
  .refine((d) => d.check_out > d.check_in, {
    path: ["check_out"],
    message: "Check-out must be after check-in",
  });

export const bookingIntentSchema = z.object({
  room_id: z.string().uuid(),
  room_type_id: z.string().uuid(),
  check_in: z.string(),
  check_out: z.string(),
  guests_count: z.number().int(),
  guest_name: z.string(),
  guest_email: z.string(),
  guest_phone: z.string(),
  payment_method: z.literal("pay_at_hotel"),
  subtotal: z.number(),
  tax_amount: z.number(),
  service_amount: z.number(),
  total_amount: z.number(),
  special_requests: z.string().optional(),
  ac_addon: z.boolean().default(false),
  expires_at: z.number(),
});

export type RoomTypeInput = z.infer<typeof roomTypeSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type BookingFormInput = z.infer<typeof bookingFormSchema>;
export type BookingIntent = z.infer<typeof bookingIntentSchema>;
