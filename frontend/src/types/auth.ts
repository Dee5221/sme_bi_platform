export interface RoleResponse {
  id: number;
  role_name: string;
}

export interface UserResponse {
  id: number;
  business_id: number;
  name: string;
  email: string;
  role: RoleResponse;
  status: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}