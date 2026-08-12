import {
  ADMINISTRATOR_PERMISSIONS,
  ALL_PERMISSIONS,
  EXTERNAL_CUSTOMER_PERMISSIONS,
  EXTERNAL_SUPPLIER_PERMISSIONS,
  OWNER_MANAGER_PERMISSIONS,
  ROLE_ADMINISTRATOR,
  ROLE_EXTERNAL_CUSTOMER,
  ROLE_EXTERNAL_SUPPLIER,
  ROLE_OWNER_MANAGER,
  ROLE_STAFF,
  STAFF_PERMISSIONS,
} from '../constants/permissions';
import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { signAuthToken } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { LoginInput, RegisterInput } from '../validators/authValidators';
import { ensureDefaultProductCategories } from './categoryService';

function sanitizeUser(user: {
  id: string;
  businessId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  accountType: string | null;
  customerId: string | null;
  supplierId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: { role: { name: string; permissions: { permission: { key: string } }[] } }[];
  business: { id: string; name: string; email: string | null };
}) {
  const roles = user.roles.map((entry) => entry.role.name);
  const permissions = Array.from(
    new Set(
      user.roles.flatMap((entry) =>
        entry.role.permissions.map((item) => item.permission.key)
      )
    )
  );

  return {
    id: user.id,
    businessId: user.businessId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    accountType: user.accountType,
    customerId: user.customerId,
    supplierId: user.supplierId,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    roles,
    permissions,
    business: {
      id: user.business.id,
      name: user.business.name,
      email: user.business.email,
    },
  };
}

async function loadAuthUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      business: { select: { id: true, name: true, email: true } },
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
}

async function syncRolePermissions(
  roleId: string,
  permissionKeys: readonly string[],
  permissionMap: Map<string, { id: string }>
) {
  const permissionIds = permissionKeys
    .map((key) => permissionMap.get(key)?.id)
    .filter((id): id is string => Boolean(id));

  if (permissionIds.length > 0) {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: { notIn: permissionIds },
      },
    });
  }

  for (const key of permissionKeys) {
    const permission = permissionMap.get(key);
    if (!permission) continue;
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId,
        permissionId: permission.id,
      },
    });
  }
}

export async function ensureSystemRoles() {
  const permissions = [];
  for (const item of ALL_PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { key: item.key },
      update: { description: item.description },
      create: { key: item.key, description: item.description },
    });
    permissions.push(permission);
  }

  const permissionMap = new Map(permissions.map((item) => [item.key, item]));

  const ownerRole = await prisma.role.upsert({
    where: { name: ROLE_OWNER_MANAGER },
    update: {
      description: 'Business owner / manager with full operational oversight',
    },
    create: {
      name: ROLE_OWNER_MANAGER,
      description: 'Business owner / manager with full operational oversight',
      isSystem: true,
    },
  });

  await syncRolePermissions(
    ownerRole.id,
    OWNER_MANAGER_PERMISSIONS.map((item) => item.key),
    permissionMap
  );

  const administratorRole = await prisma.role.upsert({
    where: { name: ROLE_ADMINISTRATOR },
    update: {
      description: 'System administrator for user access and business settings',
    },
    create: {
      name: ROLE_ADMINISTRATOR,
      description: 'System administrator for user access and business settings',
      isSystem: true,
    },
  });

  await syncRolePermissions(
    administratorRole.id,
    ADMINISTRATOR_PERMISSIONS.map((item) => item.key),
    permissionMap
  );

  const staffRole = await prisma.role.upsert({
    where: { name: ROLE_STAFF },
    update: {
      description: 'Staff member for daily sales, inventory, and customer operations',
    },
    create: {
      name: ROLE_STAFF,
      description: 'Staff member for daily sales, inventory, and customer operations',
      isSystem: true,
    },
  });

  await syncRolePermissions(
    staffRole.id,
    STAFF_PERMISSIONS.map((item) => item.key),
    permissionMap
  );

  const externalCustomerRole = await prisma.role.upsert({
    where: { name: ROLE_EXTERNAL_CUSTOMER },
    update: {
      description: 'External customer portal access for purchase visibility',
    },
    create: {
      name: ROLE_EXTERNAL_CUSTOMER,
      description: 'External customer portal access for purchase visibility',
      isSystem: true,
    },
  });

  await syncRolePermissions(
    externalCustomerRole.id,
    EXTERNAL_CUSTOMER_PERMISSIONS.map((item) => item.key),
    permissionMap
  );

  const externalSupplierRole = await prisma.role.upsert({
    where: { name: ROLE_EXTERNAL_SUPPLIER },
    update: {
      description: 'External supplier portal access for supply records',
    },
    create: {
      name: ROLE_EXTERNAL_SUPPLIER,
      description: 'External supplier portal access for supply records',
      isSystem: true,
    },
  });

  await syncRolePermissions(
    externalSupplierRole.id,
    EXTERNAL_SUPPLIER_PERMISSIONS.map((item) => item.key),
    permissionMap
  );

  return {
    ownerRole,
    administratorRole,
    staffRole,
    externalCustomerRole,
    externalSupplierRole,
  };
}

export async function ensureOwnerManagerRole() {
  const { ownerRole } = await ensureSystemRoles();
  return ownerRole;
}

export async function ensureAdministratorRole() {
  const { administratorRole } = await ensureSystemRoles();
  return administratorRole;
}

export async function ensureStaffRole() {
  const { staffRole } = await ensureSystemRoles();
  return staffRole;
}

export async function ensureExternalCustomerRole() {
  const { externalCustomerRole } = await ensureSystemRoles();
  return externalCustomerRole;
}

export async function ensureExternalSupplierRole() {
  const { externalSupplierRole } = await ensureSystemRoles();
  return externalSupplierRole;
}

export async function registerBusinessOwner(input: RegisterInput) {
  await ensureOwnerManagerRole();

  const existingEmail = await prisma.user.findFirst({
    where: { email: input.email.toLowerCase() },
  });
  if (existingEmail) {
    throw new AppError(409, 'An account with this email already exists.', 'CONFLICT');
  }

  if (input.businessEmail) {
    const existingBusiness = await prisma.business.findUnique({
      where: { email: input.businessEmail.toLowerCase() },
    });
    if (existingBusiness) {
      throw new AppError(
        409,
        'A business with this email already exists.',
        'CONFLICT'
      );
    }
  }

  const role = await prisma.role.findUniqueOrThrow({
    where: { name: ROLE_OWNER_MANAGER },
  });
  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: input.businessName,
        email: input.businessEmail?.toLowerCase() ?? null,
      },
    });

    const user = await tx.user.create({
      data: {
        businessId: business.id,
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        roles: {
          create: [{ roleId: role.id }],
        },
      },
    });

    return { business, user };
  });

  await ensureDefaultProductCategories(result.business.id);

  await writeAuditLog({
    businessId: result.business.id,
    actorId: result.user.id,
    action: 'user.registered',
    entity: 'User',
    entityId: result.user.id,
    metadata: { role: ROLE_OWNER_MANAGER },
  });

  const authUser = await loadAuthUser(result.user.id);
  if (!authUser) {
    throw new AppError(500, 'Unable to complete registration.', 'INTERNAL_ERROR');
  }

  const token = signAuthToken({
    sub: authUser.id,
    businessId: authUser.businessId,
    email: authUser.email,
  });

  return { token, user: sanitizeUser(authUser) };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findFirst({
    where: {
      email: input.email.toLowerCase(),
      isActive: true,
      business: { isActive: true },
    },
    include: {
      business: { select: { id: true, name: true, email: true } },
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError(401, 'Invalid email or password.', 'UNAUTHORIZED');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password.', 'UNAUTHORIZED');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAuditLog({
    businessId: user.businessId,
    actorId: user.id,
    action: 'user.login',
    entity: 'User',
    entityId: user.id,
  });

  const token = signAuthToken({
    sub: user.id,
    businessId: user.businessId,
    email: user.email,
  });

  return { token, user: sanitizeUser(user) };
}

export async function getCurrentUser(userId: string) {
  const user = await loadAuthUser(userId);
  if (!user || !user.isActive) {
    throw new AppError(401, 'Authentication required.', 'UNAUTHORIZED');
  }
  return sanitizeUser(user);
}

export async function logoutUser(userId: string, businessId: string) {
  await writeAuditLog({
    businessId,
    actorId: userId,
    action: 'user.logout',
    entity: 'User',
    entityId: userId,
  });
}
