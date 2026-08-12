import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';

export type AuditLogListQuery = {
  search?: string;
  action?: string;
  entity?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function parseDateInput(value: string, end = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new AppError(400, 'Invalid date format. Use YYYY-MM-DD.', 'INVALID_DATE');
  }
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'Invalid date value.', 'INVALID_DATE');
  }
  return end ? endOfDay(parsed) : startOfDay(parsed);
}

function mapEntry(entry: {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: string | null;
  createdAt: Date;
  actor: { firstName: string; lastName: string; email: string } | null;
}) {
  return {
    id: entry.id,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    metadata: entry.metadata,
    createdAt: entry.createdAt,
    actorName: entry.actor
      ? `${entry.actor.firstName} ${entry.actor.lastName}`.trim()
      : 'System',
    actorEmail: entry.actor?.email ?? null,
  };
}

export async function listAuditLogs(businessId: string, query: AuditLogListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

  let createdAt: Prisma.DateTimeFilter | undefined;
  if (query.startDate || query.endDate) {
    const start = query.startDate ? parseDateInput(query.startDate) : undefined;
    const end = query.endDate ? parseDateInput(query.endDate, true) : undefined;
    if (start && end && start > end) {
      throw new AppError(400, 'Start date must be on or before end date.', 'INVALID_DATE_RANGE');
    }
    createdAt = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    };
  }

  const search = query.search?.trim();
  const where: Prisma.AuditLogWhereInput = {
    businessId,
    ...(query.action ? { action: query.action } : {}),
    ...(query.entity ? { entity: query.entity } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { action: { contains: search } },
            { entity: { contains: search } },
            { entityId: { contains: search } },
            { actor: { firstName: { contains: search } } },
            { actor: { lastName: { contains: search } } },
            { actor: { email: { contains: search } } },
          ],
        }
      : {}),
  };

  const [total, items, actionRows, entityRows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.findMany({
      where: { businessId },
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    }),
    prisma.auditLog.findMany({
      where: { businessId },
      distinct: ['entity'],
      select: { entity: true },
      orderBy: { entity: 'asc' },
    }),
  ]);

  return {
    items: items.map(mapEntry),
    filters: {
      actions: actionRows.map((row) => row.action),
      entities: entityRows.map((row) => row.entity),
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
