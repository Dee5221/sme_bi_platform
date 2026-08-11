import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';
import { AppError } from '../lib/errors';

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new AppError(422, 'Validation failed.', 'VALIDATION_ERROR', error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })))
        );
        return;
      }
      next(error);
    }
  };
}
