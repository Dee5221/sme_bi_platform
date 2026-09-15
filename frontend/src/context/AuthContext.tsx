import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as authApi from '../services/authService';
import type { UserResponse, LoginPayload } from '../types/auth';

// Extend UserResponse to include computed permissions for frontend use
type AuthUser = UserResponse & {
  permissions: string[];
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Simple RBAC mapping based on approved roles to satisfy existing hasPermission() calls

function getPermissionsForRole(roleName: string): string[] {
  const base = [];
  if (roleName === 'Business Owner') {
    base.push('owner', 'manager', 'staff', 'all');
    return [...base, 'products.view', 'products.create', 'products.update', 'products.delete', 'categories.view', 'categories.create', 'categories.update', 'categories.delete', 'sales.view', 'sales.create', 'inventory.view', 'inventory.adjust'];
  }
  if (roleName === 'Manager') {
    base.push('manager', 'staff');
    return [...base, 'products.view', 'products.create', 'products.update', 'products.delete', 'categories.view', 'categories.create', 'categories.update', 'categories.delete', 'sales.view', 'sales.create', 'inventory.view', 'inventory.adjust'];
  }
  if (roleName === 'Staff') {
    base.push('staff');
    // Staff can view inventory but NOT adjust it (per spec matrix)
    return [...base, 'products.view', 'categories.view', 'sales.view', 'sales.create', 'customers.view', 'customers.create', 'inventory.view'];
  }
  return base;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUser = async () => {
    try {
      const userData = await authApi.fetchMe();
      const authUser: AuthUser = {
        ...userData,
        permissions: getPermissionsForRole(userData.role.role_name),
      };
      setUser(authUser);
    } catch {
      // If fetchMe fails (e.g., 401 Unauthorized), clear token and user
      localStorage.removeItem('access_token');
      setUser(null);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      // Check if token exists before attempting to load user
      const token = localStorage.getItem('access_token');
      if (token) {
        await loadUser();
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setError(null);
    try {
      const tokenResponse = await authApi.login(payload);
      // Store token for F02 API client to use
      localStorage.setItem('access_token', tokenResponse.access_token);
      // Load user profile
      await loadUser();
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors, clear local state anyway
    } finally {
      localStorage.removeItem('access_token');
      setUser(null);
    }
  }, []);

  const hasPermission = useCallback(
    (key: string) => Boolean(user?.permissions.includes(key)),
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      logout,
      hasPermission,
      clearError: () => setError(null),
    }),
    [user, loading, error, login, logout, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}