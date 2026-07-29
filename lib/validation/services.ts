import { z } from "zod";

// FormData.get() yields null for a field the form doesn't render, and zod's
// .optional() accepts undefined but NOT null — so a form that simply omits an
// optional input fails with "Expected string, received null". Treat an absent
// field and a blank one the same way.
const optionalText = z.preprocess(
  (v) => (v === null ? undefined : v),
  z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
);

export const SERVICE_CATEGORIES = ["spa", "laundry", "transport", "food", "other"] as const;

export const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  description: optionalText,
  category: z.enum(SERVICE_CATEGORIES),
  price: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(0).max(1_000_000).optional(),
  ),
  image_url: optionalText,
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export const serviceRequestSchema = z.object({
  booking_id: z.string().uuid(),
  service_id: z.string().uuid(),
  scheduled_at: z
    .string()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  notes: optionalText,
});

export const serviceRequestStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["requested", "scheduled", "in_progress", "completed", "cancelled"]),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
export type ServiceRequestInput = z.infer<typeof serviceRequestSchema>;
