import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { deleteUploadIfExists, toPublicUploadPath } from '../lib/uploads';
import { getCurrentUser } from './authService';
import { ChangePasswordInput, UpdateProfileInput } from '../validators/profileValidators';

export async function getProfile(userId: string, businessId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, businessId, isActive: true },
    select: { id: true },
  });

  if (!user) {
    throw new AppError(404, 'Profile not found.', 'NOT_FOUND');
  }

  return getCurrentUser(userId);
}

export async function updateProfile(
  userId: string,
  businessId: string,
  input: UpdateProfileInput
) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, businessId, isActive: true },
  });

  if (!existing) {
    throw new AppError(404, 'Profile not found.', 'NOT_FOUND');
  }

  const nextEmail = input.email.toLowerCase();
  if (nextEmail !== existing.email) {
    const conflict = await prisma.user.findFirst({
      where: {
        email: nextEmail,
        NOT: { id: userId },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new AppError(409, 'An account with this email already exists.', 'CONFLICT');
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: nextEmail,
      phone: input.phone ?? null,
    },
  });

  await writeAuditLog({
    businessId,
    actorId: userId,
    action: 'profile.updated',
    entity: 'User',
    entityId: userId,
    metadata: {
      fields: ['firstName', 'lastName', 'email', 'phone'],
    },
  });

  return getCurrentUser(userId);
}

export async function updateAvatar(
  userId: string,
  businessId: string,
  filename: string
) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, businessId, isActive: true },
  });

  if (!existing) {
    throw new AppError(404, 'Profile not found.', 'NOT_FOUND');
  }

  const avatarUrl = toPublicUploadPath('avatars', businessId, filename);
  const previousUrl = existing.avatarUrl;

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });

  if (previousUrl && previousUrl !== avatarUrl) {
    deleteUploadIfExists(previousUrl);
  }

  await writeAuditLog({
    businessId,
    actorId: userId,
    action: 'profile.avatar_updated',
    entity: 'User',
    entityId: userId,
  });

  return getCurrentUser(userId);
}

export async function changePassword(
  userId: string,
  businessId: string,
  input: ChangePasswordInput
) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, businessId, isActive: true },
  });

  if (!existing) {
    throw new AppError(404, 'Profile not found.', 'NOT_FOUND');
  }

  const valid = await verifyPassword(input.currentPassword, existing.passwordHash);
  if (!valid) {
    throw new AppError(400, 'Current password is incorrect.', 'INVALID_PASSWORD');
  }

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await writeAuditLog({
    businessId,
    actorId: userId,
    action: 'profile.password_changed',
    entity: 'User',
    entityId: userId,
  });

  return { passwordChanged: true as const };
}
