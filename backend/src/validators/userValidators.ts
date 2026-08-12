import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[A-Za-z]/, 'Password must include a letter.')
  .regex(/[0-9]/, 'Password must include a number.');

const roleIdsSchema = z
  .array(z.string().trim().min(1))
  .min(1, 'Select at least one role.');

export const createUserSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(80, 'First name must be at most 80 characters.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required.')
    .max(80, 'Last name must be at most 80 characters.'),
  email: z.string().trim().email('Enter a valid email address.').max(255),
  phone: optionalText(40),
  password: passwordSchema,
  roleIds: roleIdsSchema,
});

export const updateUserSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(80, 'First name must be at most 80 characters.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required.')
    .max(80, 'Last name must be at most 80 characters.'),
  email: z.string().trim().email('Enter a valid email address.').max(255),
  phone: optionalText(40),
  roleIds: roleIdsSchema,
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
