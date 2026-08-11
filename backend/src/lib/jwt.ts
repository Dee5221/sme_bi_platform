import { SignOptions, sign, verify } from 'jsonwebtoken';
import { AppError } from './errors';

export type AuthTokenPayload = {
  sub: string;
  businessId: string;
  email: string;
};

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new AppError(500, 'Server authentication is not configured.', 'CONFIG_ERROR');
  }
  return secret;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn'];
  return sign(payload, getSecret(), { expiresIn });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  try {
    const decoded = verify(token, getSecret());
    if (typeof decoded !== 'object' || decoded === null) {
      throw new AppError(401, 'Invalid authentication token.', 'UNAUTHORIZED');
    }
    const { sub, businessId, email } = decoded as AuthTokenPayload;
    if (!sub || !businessId || !email) {
      throw new AppError(401, 'Invalid authentication token.', 'UNAUTHORIZED');
    }
    return { sub, businessId, email };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, 'Invalid or expired authentication token.', 'UNAUTHORIZED');
  }
}
