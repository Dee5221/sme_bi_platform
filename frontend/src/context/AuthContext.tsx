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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await authApi.fetchMe();
        if (active) setUser(result.user);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setError(null);
    const result = await authApi.login(payload);
    setUser(result.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setError(null);
    const result = await authApi.register(payload);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await authApi.logout();
    } finally {
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
      register,
      logout,
      setUser,
      hasPermission,
      clearError: () => setError(null),
    }),
    [user, loading, error, login, register, logout, hasPermission]
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
