import { prisma } from '../lib/prisma';

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getAdminDashboard(businessId: string) {
  const periodStart = daysAgo(7);

  const [
    activeUsers,
    inactiveUsers,
    roleAssignments,
    auditEventsLast7Days,
    recentActivity,
    business,
  ] = await Promise.all([
    prisma.user.count({
      where: { businessId, isActive: true },
    }),
    prisma.user.count({
      where: { businessId, isActive: false },
    }),
    prisma.userRole.findMany({
      where: { user: { businessId } },
      select: { roleId: true },
      distinct: ['roleId'],
    }),
    prisma.auditLog.count({
      where: {
        businessId,
        createdAt: { gte: periodStart },
      },
    }),
    prisma.auditLog.findMany({
      where: { businessId },
      include: {
        actor: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    business: business
      ? {
          id: business.id,
          name: business.name,
          email: business.email,
          phone: business.phone,
          isActive: business.isActive,
          createdAt: business.createdAt,
        }
      : {
          id: businessId,
          name: 'Business',
          email: null,
          phone: null,
          isActive: true,
          createdAt: new Date(),
        },
    period: {
      label: 'Last 7 days',
      start: periodStart,
    },
    kpis: {
      activeUsers,
      inactiveUsers,
      rolesInUse: roleAssignments.length,
      auditEventsLast7Days,
    },
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
