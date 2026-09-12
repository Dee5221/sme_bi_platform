export type AuthUser = {
  id: string;
  businessId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  accountType: string | null;
  customerId: string | null;
  supplierId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
  permissions: string[];
  business: {
    id: string;
    name: string;
    email: string | null;
  };
};

export type RegisterPayload = {
  businessName: string;
  businessEmail?: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};
