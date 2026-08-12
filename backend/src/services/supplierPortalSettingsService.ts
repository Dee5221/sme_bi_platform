import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { UpdateSupplierPortalSettingsInput } from '../validators/supplierPortalValidators';

function mapPortalSupplierSettings(
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  },
  business: { id: string; name: string }
) {
  return {
    business: {
      id: business.id,
      name: business.name,
    },
    supplier: {
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      status: supplier.status,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    },
  };
}

async function assertUniqueSupplierEmail(
  businessId: string,
  email: string | undefined,
  supplierId: string
) {
  if (!email) return;
  const conflict = await prisma.supplier.findFirst({
    where: {
      businessId,
      email: email.toLowerCase(),
      NOT: { id: supplierId },
    },
    select: { id: true },
  });
  if (conflict) {
    throw new AppError(
      409,
      'Another supplier record in this business already uses this email.',
      'CONFLICT'
    );
  }
}

export async function getSupplierPortalSettings(businessId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, businessId, status: 'ACTIVE' },
  });
  if (!supplier) {
    throw new AppError(404, 'Linked supplier record not found.', 'NOT_FOUND');
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  if (!business) {
    throw new AppError(404, 'Business not found.', 'NOT_FOUND');
  }

  return mapPortalSupplierSettings(supplier, business);
}

export async function updateSupplierPortalSettings(
  businessId: string,
  supplierId: string,
  actorId: string,
  input: UpdateSupplierPortalSettingsInput
) {
  const existing = await prisma.supplier.findFirst({
    where: { id: supplierId, businessId, status: 'ACTIVE' },
  });
  if (!existing) {
    throw new AppError(404, 'Linked supplier record not found.', 'NOT_FOUND');
  }

  const nextEmail = input.email?.toLowerCase();
  await assertUniqueSupplierEmail(businessId, nextEmail, supplierId);

  const supplier = await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      name: input.name,
      email: nextEmail ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
    },
  });

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { id: true, name: true },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'portal.supplier_settings.updated',
    entity: 'Supplier',
    entityId: supplierId,
    metadata: {
      fields: ['name', 'email', 'phone', 'address'],
    },
  });

  return mapPortalSupplierSettings(supplier, business);
}
