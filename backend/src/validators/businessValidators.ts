import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const updateBusinessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Business name must be at least 2 characters.')
    .max(120, 'Business name must be at most 120 characters.'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(255)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: optionalText(40),
  address: optionalText(255),
  usdToZmwRate: z
    .number()
    .finite('Enter a valid exchange rate.')
    .gt(0, 'Exchange rate must be greater than zero.')
    .max(100000, 'Exchange rate is too large.'),
  isActive: z.boolean().optional(),
});

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
