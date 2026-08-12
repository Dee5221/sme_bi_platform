import { NextFunction, Response } from 'express';
import {
  ACCOUNT_TYPE_CUSTOMER,
  ACCOUNT_TYPE_SUPPLIER,
  PermissionKey,
} from '../constants/permissions';
import { AppError } from '../lib/errors';
import { verifyAuthToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, AuthenticatedUser } from '../types/auth';

const AUTH_COOKIE = 'sme_session';

export function getAuthCookieName(): string {
  return AUTH_COOKIE;
}

function mapUser(user: {
  id: string;
  businessId: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: string | null;
  customerId: string | null;
  supplierId: string | null;
  roles: {
    role: {
      name: string;
      permissions: { permission: { key: string } }[];
    };
  }[];
}): AuthenticatedUser {
  const roles = user.roles.map((entry) => entry.role.name);
  const permissionSet = new Set<string>();
  for (const entry of user.roles) {
    for (const rolePermission of entry.role.permissions) {
      permissionSet.add(rolePermission.permission.key);
    }
  }

  return {
    id: user.id,
    businessId: user.businessId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    accountType: user.accountType,
    customerId: user.customerId,
    supplierId: user.supplierId,
    roles,
    permissions: Array.from(permissionSet) as PermissionKey[],
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cookieToken = req.cookies?.[AUTH_COOKIE] as string | undefined;
    const header = req.headers.authorization;
    const headerToken =
      header && header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    const token = cookieToken || headerToken;

    if (!token) {
      throw new AppError(401, 'Authentication required.', 'UNAUTHORIZED');
    }

    const payload = verifyAuthToken(token);
    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        businessId: payload.businessId,
        isActive: true,
        business: { isActive: true },
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError(401, 'Authentication required.', 'UNAUTHORIZED');
    }

    req.user = mapUser(user);
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermissions(...required: PermissionKey[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Authentication required.', 'UNAUTHORIZED'));
      return;
    }

    const missing = required.filter((key) => !req.user!.permissions.includes(key));
    if (missing.length > 0) {
      next(
        new AppError(
          403,
          'You do not have permission to perform this action.',
          'FORBIDDEN',
          { missing }
        )
      );
      return;
    }

    next();
  };
}

export function getBusinessIdOrThrow(req: AuthenticatedRequest): string {
  if (!req.user?.businessId) {
    throw new AppError(401, 'Authentication required.', 'UNAUTHORIZED');
  }
  return req.user.businessId;
}

export function getPortalCustomerContextOrThrow(req: AuthenticatedRequest): {
  businessId: string;
  customerId: string;
} {
  if (!req.user) {
    throw new AppError(401, 'Authentication required.', 'UNAUTHORIZED');
  }

  if (req.user.accountType !== ACCOUNT_TYPE_CUSTOMER || !req.user.customerId) {
    throw new AppError(
      403,
      'This area is only available to linked customer portal accounts.',
      'FORBIDDEN'
    );
  }

  return {
    businessId: req.user.businessId,
    customerId: req.user.customerId,
  };
}

export function getPortalSupplierContextOrThrow(req: AuthenticatedRequest): {
  businessId: string;
  supplierId: string;
} {
  if (!req.user) {
    throw new AppError(401, 'Authentication required.', 'UNAUTHORIZED');
  }

  if (req.user.accountType !== ACCOUNT_TYPE_SUPPLIER || !req.user.supplierId) {
    throw new AppError(
      403,
      'This area is only available to linked supplier portal accounts.',
      'FORBIDDEN'
    );
  }

  return {
    businessId: req.user.businessId,
    supplierId: req.user.supplierId,
  };
}
