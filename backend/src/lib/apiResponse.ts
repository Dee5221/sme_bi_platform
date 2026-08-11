import { Response } from 'express';

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  message?: string
): Response {
  const body: ApiSuccess<T> = { success: true, data };
  if (message) body.message = message;
  return res.status(status).json(body);
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  code = 'ERROR',
  details?: unknown
): Response {
  const body: ApiFailure = {
    success: false,
    error: { code, message, details },
  };
  return res.status(status).json(body);
}
