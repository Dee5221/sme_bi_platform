import { writeAuditLog } from '../lib/audit';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import {
  UpdateCustomerPortalCurrencyInput,
  UpdateCustomerPortalSettingsInput,
} from '../validators/customerPortalValidators';

function mapPortalCustomerSettings(
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    preferredCurrency: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  },
  business: { id: string; name: string; usdToZmwRate: number }
) {
  return {
    business: {
      id: business.id,
      name: business.name,
      usdToZmwRate: business.usdToZmwRate,
    },
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      preferredCurrency: customer.preferredCurrency === 'ZMW' ? 'ZMW' : 'USD',
      status: customer.status,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },
  };
}

async function assertUniqueCustomerEmail(
  businessId: string,
  email: string | undefined,
  customerId: string
) {
  if (!email) return;
  const conflict = await prisma.customer.findFirst({
    where: {
      businessId,
      email: email.toLowerCase(),
      NOT: { id: customerId },
    },
    select: { id: true },
  });
  if (conflict) {
    throw new AppError(
      409,
      'Another customer record in this business already uses this email.',
      'CONFLICT'
    );
  }
}

export async function getCustomerPortalSettings(businessId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId, status: 'ACTIVE' },
  });
  if (!customer) {
    throw new AppError(404, 'Linked customer record not found.', 'NOT_FOUND');
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, usdToZmwRate: true },
  });
  if (!business) {
    throw new AppError(404, 'Business not found.', 'NOT_FOUND');
  }

  return mapPortalCustomerSettings(customer, business);
}

export async function updateCustomerPortalSettings(
  businessId: string,
  customerId: string,
  actorId: string,
  input: UpdateCustomerPortalSettingsInput
) {
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, businessId, status: 'ACTIVE' },
  });
  if (!existing) {
    throw new AppError(404, 'Linked customer record not found.', 'NOT_FOUND');
  }

  const nextEmail = input.email?.toLowerCase();
  await assertUniqueCustomerEmail(businessId, nextEmail, customerId);

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: input.name,
      email: nextEmail ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
    },
  });

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { id: true, name: true, usdToZmwRate: true },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'portal.customer_settings.updated',
    entity: 'Customer',
    entityId: customerId,
    metadata: {
      fields: ['name', 'email', 'phone', 'address'],
    },
  });

  return mapPortalCustomerSettings(customer, business);
}

export async function updateCustomerPortalCurrency(
  businessId: string,
  customerId: string,
  actorId: string,
  input: UpdateCustomerPortalCurrencyInput
) {
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, businessId, status: 'ACTIVE' },
  });
  if (!existing) {
    throw new AppError(404, 'Linked customer record not found.', 'NOT_FOUND');
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      preferredCurrency: input.preferredCurrency,
    },
  });

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { id: true, name: true, usdToZmwRate: true },
  });

  await writeAuditLog({
    businessId,
    actorId,
    action: 'portal.customer_currency.updated',
    entity: 'Customer',
    entityId: customerId,
    metadata: {
      preferredCurrency: input.preferredCurrency,
    },
  });

  return mapPortalCustomerSettings(customer, business);
}
