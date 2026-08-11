import { CookieOptions, Response } from 'express';
import { sendSuccess } from '../lib/apiResponse';
import { getAuthCookieName } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';
import * as authService from '../services/authService';
import { LoginInput, RegisterInput } from '../validators/authValidators';

function cookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = process.env.COOKIE_SECURE === 'true' || isProduction;
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  };
}

export async function register(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await authService.registerBusinessOwner(req.body as RegisterInput);
  res.cookie(getAuthCookieName(), result.token, cookieOptions());
  sendSuccess(res, { user: result.user }, 201, 'Business account created.');
}

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await authService.loginUser(req.body as LoginInput);
  res.cookie(getAuthCookieName(), result.token, cookieOptions());
  sendSuccess(res, { user: result.user }, 200, 'Logged in successfully.');
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = await authService.getCurrentUser(req.user!.id);
  sendSuccess(res, { user });
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.user) {
    await authService.logoutUser(req.user.id, req.user.businessId);
  }
  res.clearCookie(getAuthCookieName(), { path: '/' });
  sendSuccess(res, { loggedOut: true }, 200, 'Logged out successfully.');
}
