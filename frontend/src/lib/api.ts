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

function parsePayload<T>(payload: ApiSuccessBody<T> | ApiErrorBody | null, response: Response): T {
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

  return parsePayload(payload, response);
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  let payload: ApiSuccessBody<T> | ApiErrorBody | null = null;
  try {
    payload = (await response.json()) as ApiSuccessBody<T> | ApiErrorBody;
  } catch {
    payload = null;
  }

  return parsePayload(payload, response);
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
