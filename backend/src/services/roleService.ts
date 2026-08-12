import { ALL_PERMISSIONS } from '../constants/permissions';
import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { UpdateRolePermissionsInput } from '../validators/roleValidators';

function mapRole(role: {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: { id: string; key: string; description: string | null } }[];
}) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissionKeys: role.permissions.map((entry) => entry.permission.key).sort(),
    permissions: role.permissions.map((entry) => ({
      id: entry.permission.id,
      key: entry.permission.key,
      description: entry.permission.description,
    })),
  };
}

export async function listRolesWithPermissions() {
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { isSystem: true },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.permission.findMany({
      orderBy: { key: 'asc' },
    }),
  ]);

  const catalog = permissions.map((permission) => ({
    id: permission.id,
    key: permission.key,
    description: permission.description,
  }));

  const knownKeys = new Set(ALL_PERMISSIONS.map((item) => item.key));
  const filteredCatalog = catalog.filter((item) => knownKeys.has(item.key));

  return {
    roles: roles.map(mapRole),
    permissions: filteredCatalog,
  };
}

export async function updateRolePermissions(
  businessId: string,
  actorId: string,
  roleId: string,
  input: UpdateRolePermissionsInput
) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, isSystem: true },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  if (!role) {
    throw new AppError(404, 'Role not found.', 'NOT_FOUND');
  }

  const uniqueKeys = Array.from(new Set(input.permissionKeys));
  const permissions = await prisma.permission.findMany({
    where: { key: { in: uniqueKeys } },
  });

  if (permissions.length !== uniqueKeys.length) {
    throw new AppError(
      422,
      'One or more permission keys are invalid.',
      'VALIDATION_ERROR'
    );
  }

  const previousKeys = role.permissions.map((entry) => entry.permission.key).sort();

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    for (const permission of permissions) {
      await tx.rolePermission.create({
        data: {
          roleId,
          permissionId: permission.id,
        },
      });
    }
  });

  const updated = await prisma.role.findUniqueOrThrow({
    where: { id: roleId },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  const nextKeys = updated.permissions.map((entry) => entry.permission.key).sort();

  await writeAuditLog({
    businessId,
    actorId,
    action: 'role.permissions.updated',
    entity: 'Role',
    entityId: roleId,
    metadata: {
      roleName: role.name,
      previous: previousKeys,
      next: nextKeys,
    },
  });

  return mapRole(updated);
}
