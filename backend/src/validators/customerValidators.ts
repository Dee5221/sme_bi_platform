import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Customer name must be at least 2 characters.')
    .max(120, 'Customer name must be at most 120 characters.'),
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

export const updateCustomerSchema = createCustomerSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
