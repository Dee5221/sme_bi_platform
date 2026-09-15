import { apiRequest } from '../lib/api';
import type { UserResponse, LoginPayload, TokenResponse } from '../types/auth';

export function login(payload: LoginPayload) {
  // Backend returns { access_token, token_type } directly
  return apiRequest<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMe() {
  // Backend returns UserResponse directly (no { user: ... } wrapper)
  return apiRequest<UserResponse>('/api/auth/me');
}

export function logout() {
  // JWT is stateless; backend logout is just a success message.
  // Actual state clearing happens in AuthContext.
  return apiRequest<{ message: string }>('/api/auth/logout', {
    method: 'POST',
  });
}