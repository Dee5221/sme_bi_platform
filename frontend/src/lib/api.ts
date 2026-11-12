const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'token';

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

function stripQuotes(value: string): string {
  return value.replace(/^"|"$/g, '');
}

export function readStoredToken(): string | null {
  const session = sessionStorage.getItem(TOKEN_KEY);
  if (session) return stripQuotes(session);
  const legacy = localStorage.getItem(TOKEN_KEY);
  if (legacy) {
    const token = stripQuotes(legacy);
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
    return token;
  }
  return null;
}

export function persistSessionToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
  localStorage.removeItem(TOKEN_KEY);
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = readStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
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
  } catch {
    throw new ApiClientError(response.status, 'Failed to parse response');
  }

  if (!response.ok) {
    if (response.status === 401 && endpoint !== '/api/auth/login' && endpoint !== '/api/auth/logout') {
      clearStoredToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

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

  return data as T;
}
