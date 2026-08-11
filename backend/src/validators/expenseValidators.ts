import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const createExpenseCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Category name must be at least 2 characters.')
    .max(80, 'Category name must be at most 80 characters.'),
  description: optionalText(255),
});

export const createExpenseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Expense title must be at least 2 characters.')
    .max(120, 'Expense title must be at most 120 characters.'),
  amount: z
    .number({ error: 'Amount must be a number.' })
    .finite()
    .positive('Amount must be greater than zero.')
    .max(1_000_000_000, 'Amount is too large.'),
  expenseDate: z
    .string()
    .trim()
    .min(1, 'Expense date is required.')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date.'),
  categoryId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: optionalText(500),
});

export const updateExpenseSchema = createExpenseSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
