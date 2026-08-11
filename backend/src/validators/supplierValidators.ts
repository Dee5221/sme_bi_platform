import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const createSupplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Supplier name must be at least 2 characters.')
    .max(120, 'Supplier name must be at most 120 characters.'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(255)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: optionalText(40),
  address: optionalText(255),
  notes: optionalText(500),
});

export const updateSupplierSchema = createSupplierSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
