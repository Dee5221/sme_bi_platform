import { apiRequest } from '../lib/api';

export type AdminDashboardData = {
  business: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    createdAt: string;
  };
  period: { label: string; start: string };
  kpis: {
    activeUsers: number;
    inactiveUsers: number;
    rolesInUse: number;
    auditEventsLast7Days: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: string;
    actorName: string;
    actorEmail: string | null;
  }>;
};

export function fetchAdminDashboard() {
  return apiRequest<{ dashboard: AdminDashboardData }>('/api/admin/dashboard');
}
