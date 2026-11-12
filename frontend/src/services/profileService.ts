import { apiRequest } from '../lib/api';
import type { UserResponse } from '../types/auth';

export type ProfileUser = UserResponse & {
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  permissions?: string[];
  roles?: Array<{ id?: number; role_name?: string } | string>;
};

export type UpdateProfilePayload = {
  firstName: string;
  lastName: string;
  email: string;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function fetchProfile() {
  return apiRequest<{ user: ProfileUser }>('/api/profile');
}

export function updateProfile(payload: UpdateProfilePayload) {
  return apiRequest<{ user: ProfileUser }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload: ChangePasswordPayload) {
  return apiRequest<{ passwordChanged: boolean; access_token?: string }>('/api/profile/password', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}