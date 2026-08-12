import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { UpdateBusinessInput } from '../validators/businessValidators';

function mapBusiness(business: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: business.id,
    name: business.name,
    email: business.email,
    phone: business.phone,
    address: business.address,
    isActive: business.isActive,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  };
}

async function getBusinessOrThrow(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  if (!business) {
    throw new AppError(404, 'Business not found.', 'NOT_FOUND');
  }
  return business;
}

export async function getBusiness(businessId: string) {
  const business = await getBusinessOrThrow(businessId);
  return mapBusiness(business);
}

export async function updateBusiness(
  businessId: string,
  actorId: string,
  input: UpdateBusinessInput
) {
  const existing = await getBusinessOrThrow(businessId);

  if (input.isActive === false && existing.isActive) {
    throw new AppError(
      400,
      'You cannot deactivate the business you are currently signed into.',
      'BAD_REQUEST'
    );
  }

  const nextEmail = input.email?.toLowerCase() ?? null;
  if (nextEmail && nextEmail !== existing.email) {
    const conflict = await prisma.business.findFirst({
      where: {
        email: nextEmail,
        NOT: { id: businessId },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new AppError(409, 'A business with this email already exists.', 'CONFLICT');
    }
  }

  const business = await prisma.business.update({
    where: { id: businessId },
    data: {
      name: input.name,
      email: nextEmail,
      phone: input.phone ?? null,
      address: input.address ?? null,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'business.updated',
    entity: 'Business',
    entityId: businessId,
    metadata: {
      fields: ['name', 'email', 'phone', 'address', 'isActive'],
    },
  });

  return mapBusiness(business);
}
