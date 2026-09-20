export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  business: { id: number; name: string };
  roles: string[];
  permissions: string[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}