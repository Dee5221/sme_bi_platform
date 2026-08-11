import { Prisma } from '@prisma/client';
import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
} from '../validators/customerValidators';

export type CustomerListQuery = {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  page?: number;
  pageSize?: number;
};

function mapCustomer(customer: {
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
    id: customer.id,
    businessId: customer.businessId,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    notes: customer.notes,
    status: customer.status,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

async function assertUniqueEmail(
  businessId: string,
  email: string | undefined,
  excludeId?: string
) {
  if (!email) return;
  const conflict = await prisma.customer.findFirst({
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
      'A customer with this email already exists in your business.',
      'CONFLICT'
    );
  }
}

export async function listCustomers(businessId: string, query: CustomerListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const status = query.status ?? 'ACTIVE';

  const where: Prisma.CustomerWhereInput = {
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

  const [total, customers] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: customers.map(mapCustomer),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getCustomer(businessId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
  });
  if (!customer) {
    throw new AppError(404, 'Customer not found.', 'NOT_FOUND');
  }
  return mapCustomer(customer);
}

export async function createCustomer(
  businessId: string,
  actorId: string,
  input: CreateCustomerInput
) {
  const email = input.email?.toLowerCase();
  await assertUniqueEmail(businessId, email);

  const customer = await prisma.customer.create({
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
    action: 'customer.created',
    entity: 'Customer',
    entityId: customer.id,
  });

  return mapCustomer(customer);
}

export async function updateCustomer(
  businessId: string,
  actorId: string,
  customerId: string,
  input: UpdateCustomerInput
) {
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
  });
  if (!existing) {
    throw new AppError(404, 'Customer not found.', 'NOT_FOUND');
  }

  const email = input.email?.toLowerCase();
  await assertUniqueEmail(businessId, email, customerId);

  const customer = await prisma.customer.update({
    where: { id: customerId },
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
    action: 'customer.updated',
    entity: 'Customer',
    entityId: customerId,
  });

  return mapCustomer(customer);
}

export async function deactivateCustomer(
  businessId: string,
  actorId: string,
  customerId: string
) {
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
  });
  if (!existing) {
    throw new AppError(404, 'Customer not found.', 'NOT_FOUND');
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: { status: 'INACTIVE' },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'customer.deactivated',
    entity: 'Customer',
    entityId: customerId,
  });

  return mapCustomer(customer);
}
