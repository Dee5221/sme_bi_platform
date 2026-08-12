import { z } from 'zod';
import { ALL_PERMISSIONS } from '../constants/permissions';

const permissionKeys = ALL_PERMISSIONS.map((item) => item.key) as [string, ...string[]];

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z
    .array(z.enum(permissionKeys))
    .min(1, 'A role must have at least one permission.'),
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
