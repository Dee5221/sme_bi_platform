import { Request } from 'express';
import { PermissionKey } from '../constants/permissions';

export type AuthenticatedUser = {
  id: string;
  businessId: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions: PermissionKey[];
  roles: string[];
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};
