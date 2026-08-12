import { z } from 'zod';

export const stockAdjustSchema = z.object({
  productId: z.string().trim().min(1, 'Product is required.'),
  quantity: z
    .number({ error: 'Quantity must be a number.' })
    .int('Quantity must be a whole number.')
    .positive('Quantity must be greater than zero.')
    .max(1_000_000, 'Quantity is too large.'),
  reason: z
    .string()
    .trim()
    .max(255, 'Reason must be at most 255 characters.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  supplierId: z.string().trim().min(1, 'Supplier is required.').optional(),
});

export const updateThresholdSchema = z.object({
  lowStockThreshold: z
    .number({ error: 'Threshold must be a number.' })
    .int('Threshold must be a whole number.')
    .min(0, 'Threshold cannot be negative.')
    .max(1_000_000, 'Threshold is too large.'),
});

export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
export type UpdateThresholdInput = z.infer<typeof updateThresholdSchema>;
