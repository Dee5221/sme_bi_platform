import { clearStoredToken, readStoredToken } from '../lib/api';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type ReportTypeId =
  | 'sales'
  | 'product_performance'
  | 'inventory'
  | 'expenses'
  | 'gross_profit'
  | 'forecast_recommendations'
  | 'business_summary';

export type ReportType = {
  id: ReportTypeId;
  title: string;
};

function authHeaders(): HeadersInit {
  const token = readStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function downloadReport(
  reportType: ReportTypeId,
  startDate: string,
  endDate: string
): Promise<void> {
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  const response = await fetch(`${API_BASE}/api/reports/${reportType}?${params.toString()}`, {
    credentials: 'include',
    headers: authHeaders(),
  });

  if (!response.ok) {
    let message = `Unable to generate report (${response.status})`;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === 'string') message = body.detail;
    }
    if (response.status === 401) {
      clearStoredToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `${reportType}-report.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
