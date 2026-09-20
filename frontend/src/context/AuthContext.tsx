import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../services/authService';
import type { AuthUser, LoginPayload, RegisterPayload } from '../types/auth';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  hasPermission: (key: string) => boolean;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getPermissionsForRole(roleName: string): string[] {
  const base: string[] = []; // Fixed implicit any
  if (roleName === 'Business Owner') {
    return [...base, 'owner', 'manager', 'staff', 'all', 'products.view', 'products.create', 'products.update', 'products.delete', 'categories.view', 'categories.create', 'categories.update', 'categories.delete', 'sales.view', 'sales.create', 'inventory.view', 'inventory.adjust', 'expenses.view', 'expenses.create'];
  }
  if (roleName === 'Manager') {
    return [...base, 'manager', 'staff', 'products.view', 'products.create', 'products.update', 'products.delete', 'categories.view', 'categories.create', 'categories.update', 'categories.delete', 'sales.view', 'sales.create', 'inventory.view', 'inventory.adjust', 'expenses.view', 'expenses.create'];
  }
  if (roleName === 'Staff') {
    return [...base, 'staff', 'products.view', 'categories.view', 'sales.view', 'sales.create', 'customers.view', 'customers.create', 'inventory.view'];
  }
  return base;
}

// Maps backend response to Member 2's expected UI shape
function mapBackendUser(backendUser: any): AuthUser {
  const nameParts = backendUser.name.split(' ');
  return {
    id: backendUser.id,
    firstName: nameParts[0] || backendUser.name,
    lastName: nameParts.slice(1).join(' ') || '',
    email: backendUser.email,
    avatarUrl: null,
    isActive: backendUser.status === 'active',
    business: { id: backendUser.business_id, name: 'Demo Business' }, 
    roles: [backendUser.role?.role_name || 'Staff'],
    permissions: getPermissionsForRole(backendUser.role?.role_name || 'Staff'),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const userData = await authApi.fetchMe();
          if (active) setUser(mapBackendUser(userData));
        } catch {
          if (active) {
            localStorage.removeItem('access_token');
            setUser(null);
          }
        }
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setError(null);
    try {
      const tokenResponse = await authApi.login(payload);
      localStorage.setItem('access_token', tokenResponse.access_token);
      const userData = await authApi.fetchMe();
      setUser(mapBackendUser(userData));
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    }
  }, []);

  const register = useCallback(async (_payload: RegisterPayload) => {
    // Public registration is disabled per spec. Dummy function to prevent UI crashes.
    throw new Error('Public registration is not supported. Please contact an administrator.');
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try { await authApi.logout(); } catch {}
    finally {
      localStorage.removeItem('access_token');
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback(
    (key: string) => Boolean(user?.permissions.includes(key) || user?.permissions.includes('all')),
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, error, login, register, logout, setUser, hasPermission, clearError: () => setError(null) }),
    [user, loading, error, login, register, logout, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}