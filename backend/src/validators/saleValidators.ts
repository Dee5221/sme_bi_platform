import { z } from 'zod';

export const createSaleSchema = z.object({
  customerId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: z
    .string()
    .trim()
    .max(500, 'Notes must be at most 500 characters.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1, 'Product is required.'),
        quantity: z
          .number({ error: 'Quantity must be a number.' })
          .int('Quantity must be a whole number.')
          .positive('Quantity must be greater than zero.')
          .max(1_000_000, 'Quantity is too large.'),
      })
    )
    .min(1, 'Add at least one product line.'),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
