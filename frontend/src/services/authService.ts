import { apiRequest } from '../lib/api';
import type { AuthUser, LoginPayload, RegisterPayload } from '../types/auth';

export function register(payload: RegisterPayload) {
  return apiRequest<{ user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginPayload) {
  return apiRequest<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMe() {
  return apiRequest<{ user: AuthUser }>('/api/auth/me');
}

export function logout() {
  return apiRequest<{ loggedOut: boolean }>('/api/auth/logout', {
    method: 'POST',
  });
}
