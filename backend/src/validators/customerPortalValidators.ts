import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const updateCustomerPortalSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(120, 'Name must be at most 120 characters.'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(255)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: optionalText(40),
  address: optionalText(255),
});

export type UpdateCustomerPortalSettingsInput = z.infer<
  typeof updateCustomerPortalSettingsSchema
>;
