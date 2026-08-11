import { z } from 'zod';

export const updateProfileSchema = z.object({
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
  phone: z
    .string()
    .trim()
    .max(40, 'Phone must be at most 40 characters.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(128, 'Password must be at most 128 characters.')
      .regex(/[A-Za-z]/, 'Password must include a letter.')
      .regex(/[0-9]/, 'Password must include a number.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password.',
    path: ['newPassword'],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
