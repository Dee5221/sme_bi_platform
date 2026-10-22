import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiRequest, ApiClientError } from '../lib/api';

// Matches the ACTUAL backend response shape from /api/auth/me
// Backend User model has: role = relationship("Role") -> { id, role_name }
export type AuthUser = {
  id: number;
  email: string;
  business_id: number;
  first_name?: string | null;
  last_name?: string | null;
  status?: string;
  // Backend returns role as a NESTED OBJECT: { id: number, role_name: string }
  role?: { id: number; role_name: string } | string | null;
  // Fallback fields in case backend shape varies
  role_name?: string | null;
  roles?: Array<{ role_name: string } | string> | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Comprehensive permissions for each role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  'Business Owner': [
    'dashboard.view',
    'sales.view', 'sales.create', 'sales.update', 'sales.delete',
    'products.view', 'products.create', 'products.update', 'products.delete',
    'inventory.view', 'inventory.adjust',
    'customers.view', 'customers.create', 'customers.update', 'customers.delete',
    'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
    'expenses.view', 'expenses.create', 'expenses.update', 'expenses.delete',
    'users.view', 'users.create', 'users.update', 'users.delete',
    'analytics.view',
    'forecasting.view',
    'recommendations.view',
    'reports.view',
    'settings.view', 'settings.update',
    'profile.view', 'profile.update',
    'roles.view', 'roles.update',
    'activity-log.view',
    'all',
  ],
  'Manager': [
    'dashboard.view',
    'sales.view', 'sales.create', 'sales.update',
    'products.view', 'products.create', 'products.update',
    'inventory.view', 'inventory.adjust',
    'customers.view', 'customers.create', 'customers.update',
    'suppliers.view', 'suppliers.create', 'suppliers.update',
    'expenses.view', 'expenses.create', 'expenses.update',
    'users.view',
    'analytics.view',
    'reports.view',
    'profile.view', 'profile.update',
    'all',
  ],
  'Staff': [
    'dashboard.view',
    'sales.view', 'sales.create',
    'products.view',
    'inventory.view',
    'customers.view',
    'suppliers.view',
    'expenses.view',
    'profile.view', 'profile.update',
  ],
};

// Extracts the role name from the backend response
// Handles the NESTED OBJECT format: { role: { role_name: "Business Owner" } }
function extractRoleName(user: AuthUser): string | null {
  if (!user) return null;

  // PRIMARY CASE: Backend returns role as { id, role_name } object
  if (user.role && typeof user.role === 'object' && 'role_name' in user.role) {
    return (user.role as { role_name: string }).role_name;
  }

  // FALLBACK: role is a plain string
  if (typeof user.role === 'string') {
    return user.role;
  }

  // FALLBACK: role_name field exists
  if (user.role_name && typeof user.role_name === 'string') {
    return user.role_name;
  }

  // FALLBACK: roles array
  if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
    const firstRole = user.roles[0];
    if (typeof firstRole === 'string') return firstRole;
    if (typeof firstRole === 'object' && firstRole.role_name) {
      return firstRole.role_name;
    }
  }

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    apiRequest<AuthUser>('/api/auth/me')
      .then((data) => {
        console.log('✅ [Auth] User data loaded:', data);
        console.log('✅ [Auth] Role detected:', extractRoleName(data));
        setUser(data);
      })
      .catch((err) => {
        console.error('❌ [Auth] Failed to load user, clearing token:', err);
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials: { email: string; password: string }) {
    try {
      const response = await apiRequest<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      let token: string | null = null;
      if (typeof response === 'string') {
        token = response.replace(/^"|"$/g, '');
      } else if (response && typeof response === 'object') {
        token = response.access_token || response.token || null;
      }

      if (!token) {
        throw new Error('Login succeeded but no token was returned by the server.');
      }

      localStorage.setItem('token', token);

      const me = await apiRequest<AuthUser>('/api/auth/me');
      console.log('✅ [Auth] Login successful. Role:', extractRoleName(me));
      setUser(me);
    } catch (err) {
      console.error('❌ [Auth] Login failed:', err);
      throw err;
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  function hasPermission(permission: string): boolean {
    if (!user) return false;

    const roleName = extractRoleName(user);
    if (!roleName) {
      console.warn('⚠️ [Auth] No role found for user. Raw user data:', user);
      return false;
    }

    const perms = ROLE_PERMISSIONS[roleName] || [];
    const hasIt = perms.includes(permission) || perms.includes('all');
    return hasIt;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiClientError };