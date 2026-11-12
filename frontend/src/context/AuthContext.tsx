import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  apiRequest,
  ApiClientError,
  clearStoredToken,
  persistSessionToken,
} from '../lib/api';

export type AuthUser = {
  id: number;
  email: string;
  name?: string | null;
  business_id: number;
  status?: string;
  role?: { id: number; role_name: string } | string | null;
  role_name?: string | null;
  permissions?: string[];
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  applySessionToken: (token: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_UNAUTHORIZED = 'auth:unauthorized';

function extractRoleName(user: AuthUser | null): string | null {
  if (!user) return null;
  if (user.role_name) return user.role_name;
  if (user.role && typeof user.role === 'object' && 'role_name' in user.role) {
    return user.role.role_name;
  }
  if (typeof user.role === 'string') return user.role;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function clearSession() {
      clearStoredToken();
      setUser(null);
    }

    window.addEventListener(AUTH_UNAUTHORIZED, clearSession);

    apiRequest<AuthUser>('/api/auth/me')
      .then((data) => setUser(data))
      .catch(() => {
        clearStoredToken();
        setUser(null);
      })
      .finally(() => setLoading(false));

    return () => window.removeEventListener(AUTH_UNAUTHORIZED, clearSession);
  }, []);

  async function login(credentials: { email: string; password: string }) {
    const response = await apiRequest<{ access_token?: string; token?: string } | string>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      }
    );

    let token: string | null = null;
    if (typeof response === 'string') {
      token = response.replace(/^"|"$/g, '');
    } else if (response && typeof response === 'object') {
      token = response.access_token || response.token || null;
    }

    persistSessionToken(token);
    const me = await apiRequest<AuthUser>('/api/auth/me');
    setUser(me);
  }

  async function refreshUser() {
    const me = await apiRequest<AuthUser>('/api/auth/me');
    setUser(me);
  }

  async function applySessionToken(token: string) {
    persistSessionToken(token);
    await refreshUser();
  }

  function logout() {
    void apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearStoredToken();
    setUser(null);
  }

  function hasPermission(permission: string): boolean {
    if (!user) return false;
    const permissions = user.permissions;
    if (!Array.isArray(permissions) || permissions.length === 0) return false;
    return permissions.includes(permission);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refreshUser, applySessionToken, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiClientError, extractRoleName };
