import { apiRequest, apiUpload } from '../lib/api';
import type { AuthUser } from '../types/auth';

export type UpdateProfilePayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function fetchProfile() {
  return apiRequest<{ user: AuthUser }>('/api/profile');
}

export function updateProfile(payload: UpdateProfilePayload) {
  return apiRequest<{ user: AuthUser }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload: ChangePasswordPayload) {
  return apiRequest<{ passwordChanged: boolean }>('/api/profile/password', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append('image', file);
  return apiUpload<{ user: AuthUser }>('/api/profile/avatar', formData);
}
