import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .or(z.literal(""))
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const today = () => new Date().toISOString().slice(0, 10);

export const walkInBookingSchema = z
  .object({
    room_type_id: z.string().uuid(),
    check_in: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Check-in must be a date")
      .refine((v) => v >= today(), "Check-in must be today or later"),
    check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    guests_count: z.coerce.number().int().min(1).max(20),
    guest_name: z.string().trim().min(2).max(120),
    guest_email: optionalEmail,
    guest_phone: z
      .string()
      .trim()
      .min(7)
      .max(32)
      .regex(/^[+\d][\d\s\-()]+$/, "Enter a valid phone number"),
    payment_method: z.enum(["online", "pay_at_hotel"]),
    payment_status: z.enum(["unpaid", "paid"]).default("unpaid"),
    payment_provider: z.enum(["khalti", "esewa", "cash"]).optional(),
    payment_reference: optionalText,
    initial_status: z.enum(["confirmed", "checked_in"]).default("confirmed"),
    special_requests: optionalText,
  })
  .refine((d) => d.check_out > d.check_in, {
    path: ["check_out"],
    message: "Check-out must be after check-in",
  });

export const inviteStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(["receptionist", "manager", "super_admin"]),
});

export const changeRoleSchema = z.object({
  profile_id: z.string().uuid(),
  role: z.enum(["receptionist", "manager", "super_admin"]),
});

export const toggleActiveSchema = z.object({
  profile_id: z.string().uuid(),
  is_active: z.boolean(),
});

export type WalkInBookingInput = z.infer<typeof walkInBookingSchema>;
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type ToggleActiveInput = z.infer<typeof toggleActiveSchema>;
