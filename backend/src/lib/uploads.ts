import fs from 'fs';
import path from 'path';

export const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

export function ensureUploadDir(...parts: string[]) {
  const dir = path.join(UPLOADS_ROOT, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function toPublicUploadPath(...parts: string[]) {
  return `/uploads/${parts.map((part) => part.replace(/^\/+|\/+$/g, '')).join('/')}`;
}

export function resolveUploadPathFromUrl(publicUrl: string | null | undefined) {
  if (!publicUrl || !publicUrl.startsWith('/uploads/')) return null;
  const relative = publicUrl.replace(/^\/uploads\//, '');
  return path.join(UPLOADS_ROOT, relative);
}

export function deleteUploadIfExists(publicUrl: string | null | undefined) {
  const absolute = resolveUploadPathFromUrl(publicUrl);
  if (!absolute) return;
  if (fs.existsSync(absolute)) {
    fs.unlinkSync(absolute);
  }
}
