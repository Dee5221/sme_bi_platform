const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiSuccessBody<T> = {
  success: true;
  data: T;
  message?: string;
};

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  let payload: ApiSuccessBody<T> | ApiErrorBody | null = null;
  try {
    payload = (await response.json()) as ApiSuccessBody<T> | ApiErrorBody;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.success === false) {
    const message =
      payload && 'error' in payload
        ? payload.error.message
        : 'Something went wrong. Please try again.';
    const code = payload && 'error' in payload ? payload.error.code : 'REQUEST_FAILED';
    const details = payload && 'error' in payload ? payload.error.details : undefined;
    throw new ApiClientError(response.status, message, code, details);
  }

  return payload.data;
}
