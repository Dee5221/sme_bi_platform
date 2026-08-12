import { Prisma } from '@prisma/client';
import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { hashPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { CreateUserInput, UpdateUserInput } from '../validators/userValidators';

export type UserListQuery = {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  page?: number;
  pageSize?: number;
};

function mapUser(user: {
  id: string;
  businessId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles: { role: { id: string; name: string } }[];
}) {
  return {
    id: user.id,
    businessId: user.businessId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    phone: user.phone,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.roles.map((entry) => entry.role.name),
    roleIds: user.roles.map((entry) => entry.role.id),
  };
}

const userInclude = {
  roles: {
    include: {
      role: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.UserInclude;

async function assertUniqueEmail(email: string, excludeId?: string) {
  const conflict = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    throw new AppError(409, 'An account with this email already exists.', 'CONFLICT');
  }
}

async function resolveRoleIds(roleIds: string[]) {
  const uniqueIds = Array.from(new Set(roleIds));
  const roles = await prisma.role.findMany({
    where: { id: { in: uniqueIds }, isSystem: true },
    select: { id: true, name: true },
  });
  if (roles.length !== uniqueIds.length) {
    throw new AppError(
      422,
      'One or more selected roles are invalid.',
      'VALIDATION_ERROR'
    );
  }
  return roles;
}

async function getUserOrThrow(businessId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, businessId },
    include: userInclude,
  });
  if (!user) {
    throw new AppError(404, 'User not found.', 'NOT_FOUND');
  }
  return user;
}

export async function listAssignableRoles() {
  const roles = await prisma.role.findMany({
    where: { isSystem: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true },
  });
  return roles;
}

export async function listUsers(businessId: string, query: UserListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const status = query.status ?? 'ACTIVE';

  const where: Prisma.UserWhereInput = {
    businessId,
    ...(status === 'ACTIVE'
      ? { isActive: true }
      : status === 'INACTIVE'
        ? { isActive: false }
        : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search } },
            { lastName: { contains: query.search } },
            { email: { contains: query.search } },
            { phone: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: userInclude,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: users.map(mapUser),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getUser(businessId: string, userId: string) {
  const user = await getUserOrThrow(businessId, userId);

  const recentActivity = await prisma.auditLog.findMany({
    where: {
      businessId,
      OR: [{ actorId: userId }, { entity: 'User', entityId: userId }],
    },
    include: {
      actor: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  return {
    user: mapUser(user),
    recentActivity: recentActivity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      createdAt: entry.createdAt,
      actorName: entry.actor
        ? `${entry.actor.firstName} ${entry.actor.lastName}`.trim()
        : 'System',
      actorEmail: entry.actor?.email ?? null,
    })),
  };
}

export async function createUser(
  businessId: string,
  actorId: string,
  input: CreateUserInput
) {
  const email = input.email.toLowerCase();
  await assertUniqueEmail(email);
  const roles = await resolveRoleIds(input.roleIds);
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      businessId,
      email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      roles: {
        create: roles.map((role) => ({ roleId: role.id })),
      },
    },
    include: userInclude,
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'user.created',
    entity: 'User',
    entityId: user.id,
    metadata: { roles: roles.map((role) => role.name) },
  });

  return mapUser(user);
}

export async function updateUser(
  businessId: string,
  actorId: string,
  userId: string,
  input: UpdateUserInput
) {
  const existing = await getUserOrThrow(businessId, userId);
  const email = input.email.toLowerCase();
  await assertUniqueEmail(email, userId);
  const roles = await resolveRoleIds(input.roleIds);

  if (userId === actorId && input.isActive === false) {
    throw new AppError(400, 'You cannot deactivate your own account.', 'BAD_REQUEST');
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId } });
    return tx.user.update({
      where: { id: userId },
      data: {
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        roles: {
          create: roles.map((role) => ({ roleId: role.id })),
        },
      },
      include: userInclude,
    });
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'user.updated',
    entity: 'User',
    entityId: userId,
    metadata: {
      roles: roles.map((role) => role.name),
      isActive: user.isActive,
    },
  });

  return mapUser(user);
}

export async function deactivateUser(
  businessId: string,
  actorId: string,
  userId: string
) {
  if (userId === actorId) {
    throw new AppError(400, 'You cannot deactivate your own account.', 'BAD_REQUEST');
  }

  const existing = await getUserOrThrow(businessId, userId);
  if (!existing.isActive) {
    return mapUser(existing);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    include: userInclude,
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'user.deactivated',
    entity: 'User',
    entityId: userId,
  });

  return mapUser(user);
}
