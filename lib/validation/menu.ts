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

export const foodItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  description: optionalText,
  price: z.coerce.number().min(0).max(1_000_000),
  category: z.string().trim().min(1).max(60),
  image_url: optionalText,
  is_available: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export type FoodItemInput = z.infer<typeof foodItemSchema>;
