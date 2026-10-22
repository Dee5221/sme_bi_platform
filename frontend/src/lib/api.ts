const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export class ApiClientError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const rawToken = localStorage.getItem('token');
  const token = rawToken ? rawToken.replace(/^"|"$/g, '') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log(`📡 [API] ${options.method || 'GET'} ${endpoint}`, token ? '(with token)' : '(no token)');

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  let data: unknown;
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  } catch (parseError) {
    console.error('❌ [API] Failed to parse response:', parseError);
    throw new ApiClientError(response.status, 'Failed to parse response');
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let details: unknown;

    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (typeof obj.detail === 'string') {
        message = obj.detail;
      } else if (Array.isArray(obj.detail)) {
        details = obj.detail;
        const first = obj.detail[0] as { msg?: string } | undefined;
        if (first?.msg) message = first.msg;
      } else if (typeof obj.message === 'string') {
        message = obj.message;
      }
    } else if (typeof data === 'string' && data) {
      message = data;
    }

    throw new ApiClientError(response.status, message, details);
  }

  console.log(`✅ [API] Response received:`, typeof data === 'object' ? JSON.stringify(data).substring(0, 100) : data);
  return data as T;
}