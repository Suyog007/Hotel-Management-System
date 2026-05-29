import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

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
