import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { AppError } from '../lib/errors';
import { ensureUploadDir } from '../lib/uploads';
import { AuthenticatedRequest } from '../types/auth';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024;

function extensionFor(file: Express.Multer.File) {
  const fromName = path.extname(file.originalname).toLowerCase();
  if (fromName && ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(fromName)) {
    return fromName === '.jpeg' ? '.jpg' : fromName;
  }
  if (file.mimetype === 'image/png') return '.png';
  if (file.mimetype === 'image/webp') return '.webp';
  if (file.mimetype === 'image/gif') return '.gif';
  return '.jpg';
}

function createUploader(subdir: 'avatars' | 'products') {
  return multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        const businessId = (req as AuthenticatedRequest).user?.businessId;
        if (!businessId) {
          cb(new AppError(401, 'Authentication required.', 'UNAUTHORIZED'), '');
          return;
        }
        cb(null, ensureUploadDir(subdir, businessId));
      },
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${extensionFor(file)}`);
      },
    }),
    limits: { fileSize: MAX_BYTES },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        cb(new AppError(400, 'Only JPEG, PNG, WebP, or GIF images are allowed.', 'INVALID_FILE_TYPE'));
        return;
      }
      cb(null, true);
    },
  });
}

export const avatarUpload = createUploader('avatars');
export const productImageUpload = createUploader('products');

export function requireUploadedImage(fieldName = 'image') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.file) {
      next(new AppError(400, `Please choose an image to upload (${fieldName}).`, 'FILE_REQUIRED'));
      return;
    }
    next();
  };
}

export function handleUploadErrors(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'Image must be 5MB or smaller.', 'FILE_TOO_LARGE'));
      return;
    }
    next(new AppError(400, err.message, 'UPLOAD_ERROR'));
    return;
  }
  next(err);
}
