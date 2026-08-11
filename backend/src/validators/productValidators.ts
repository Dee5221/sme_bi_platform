import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Category name must be at least 2 characters.')
    .max(80, 'Category name must be at most 80 characters.'),
  description: z
    .string()
    .trim()
    .max(255, 'Description must be at most 255 characters.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const updateCategorySchema = createCategorySchema.extend({
  isActive: z.boolean().optional(),
});

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Product name must be at least 2 characters.')
    .max(120, 'Product name must be at most 120 characters.'),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required.')
    .max(60, 'SKU must be at most 60 characters.')
    .regex(/^[A-Za-z0-9_-]+$/, 'SKU may only contain letters, numbers, hyphens, and underscores.'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be at most 500 characters.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  unit: z
    .string()
    .trim()
    .max(30, 'Unit must be at most 30 characters.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  price: z
    .number({ error: 'Price must be a number.' })
    .finite()
    .nonnegative('Price cannot be negative.')
    .max(1_000_000_000, 'Price is too large.'),
  categoryId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const updateProductSchema = createProductSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
