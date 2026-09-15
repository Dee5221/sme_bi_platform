const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export class ApiClientError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = detail;
  }
}

function getToken(): string | null {
  // Reads the JWT access token from localStorage. 
  // F03 will handle setting this token upon successful login.
  return localStorage.getItem('access_token');
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  // 1. Attach JWT Bearer token if available
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // 2. Set Content-Type to JSON only if there's a body and it's not FormData
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // 3. Execute request (removed credentials: 'include' as JWT is used)
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // 4. Parse response safely
  const contentType = response.headers.get('content-type');
  let data: unknown = null;
  
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  // 5. Handle HTTP errors using FastAPI's native "detail" field
  if (!response.ok) {
    const detail = (data as any)?.detail || 'An unexpected error occurred';
    const message = typeof detail === 'string' ? detail : JSON.stringify(detail);
    throw new ApiClientError(response.status, message, detail);
  }

  // 6. Return raw data (object, array, or null) without artificial envelope
  return data as T;
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Note: Do NOT set Content-Type for FormData; the browser sets it with the correct boundary.

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: options.method || 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // ignore parsing error on failure
    }
    const detail = (data as any)?.detail || 'Upload failed';
    const message = typeof detail === 'string' ? detail : JSON.stringify(detail);
    throw new ApiClientError(response.status, message, detail);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  
  return {} as T; // Fallback for non-JSON success responses
}