import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../lib/apiResponse';
import { isAppError } from '../lib/errors';

export function notFoundHandler(_req: Request, res: Response): void {
  sendError(res, 404, 'Resource not found.', 'NOT_FOUND');
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    sendError(
      res,
      422,
      'Validation failed.',
      'VALIDATION_ERROR',
      err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
    );
    return;
  }

  if (isAppError(err)) {
    sendError(res, err.statusCode, err.message, err.code, err.details);
    return;
  }

  console.error('[error]', err);
  sendError(res, 500, 'An unexpected error occurred.', 'INTERNAL_ERROR');
}
