import { Prisma } from '@prisma/client';
import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import {
  CreateSupplierInput,
  UpdateSupplierInput,
} from '../validators/supplierValidators';

export type SupplierListQuery = {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  page?: number;
  pageSize?: number;
};

function mapSupplier(supplier: {
  id: string;
  businessId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: supplier.id,
    businessId: supplier.businessId,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    notes: supplier.notes,
    status: supplier.status,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

async function assertUniqueEmail(
  businessId: string,
  email: string | undefined,
  excludeId?: string
) {
  if (!email) return;
  const conflict = await prisma.supplier.findFirst({
    where: {
      businessId,
      email: email.toLowerCase(),
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    throw new AppError(
      409,
      'A supplier with this email already exists in your business.',
      'CONFLICT'
    );
  }
}

export async function listSuppliers(businessId: string, query: SupplierListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const status = query.status ?? 'ACTIVE';

  const where: Prisma.SupplierWhereInput = {
    businessId,
    ...(status !== 'ALL' ? { status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search } },
            { email: { contains: query.search } },
            { phone: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [total, suppliers] = await prisma.$transaction([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: suppliers.map(mapSupplier),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getSupplier(businessId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, businessId },
  });
  if (!supplier) {
    throw new AppError(404, 'Supplier not found.', 'NOT_FOUND');
  }
  return mapSupplier(supplier);
}

export async function createSupplier(
  businessId: string,
  actorId: string,
  input: CreateSupplierInput
) {
  const email = input.email?.toLowerCase();
  await assertUniqueEmail(businessId, email);

  const supplier = await prisma.supplier.create({
    data: {
      businessId,
      name: input.name,
      email: email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      status: 'ACTIVE',
    },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'supplier.created',
    entity: 'Supplier',
    entityId: supplier.id,
  });

  return mapSupplier(supplier);
}

export async function updateSupplier(
  businessId: string,
  actorId: string,
  supplierId: string,
  input: UpdateSupplierInput
) {
  const existing = await prisma.supplier.findFirst({
    where: { id: supplierId, businessId },
  });
  if (!existing) {
    throw new AppError(404, 'Supplier not found.', 'NOT_FOUND');
  }

  const email = input.email?.toLowerCase();
  await assertUniqueEmail(businessId, email, supplierId);

  const supplier = await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      name: input.name,
      email: email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      ...(input.status ? { status: input.status } : {}),
    },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'supplier.updated',
    entity: 'Supplier',
    entityId: supplierId,
  });

  return mapSupplier(supplier);
}

export async function deactivateSupplier(
  businessId: string,
  actorId: string,
  supplierId: string
) {
  const existing = await prisma.supplier.findFirst({
    where: { id: supplierId, businessId },
  });
  if (!existing) {
    throw new AppError(404, 'Supplier not found.', 'NOT_FOUND');
  }

  const supplier = await prisma.supplier.update({
    where: { id: supplierId },
    data: { status: 'INACTIVE' },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'supplier.deactivated',
    entity: 'Supplier',
    entityId: supplierId,
  });

  return mapSupplier(supplier);
}
