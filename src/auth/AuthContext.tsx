import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  loadStoredUser,
  login as apiLogin,
  logout as apiLogout,
  persistSession,
  refreshAccessToken,
  type AuthUser,
  type LoginResponse,
} from "@/lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenVersion, setTokenVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = loadStoredUser();
      const access = getAccessToken();
      const refresh = getRefreshToken();

      if (!stored || stored.role !== "SUPER_ADMIN") {
        clearSession();
        if (!cancelled) setUser(null);
        if (!cancelled) setIsLoading(false);
        return;
      }

      if (!access && !refresh) {
        clearSession();
        if (!cancelled) setUser(null);
        if (!cancelled) setIsLoading(false);
        return;
      }

      if (!access && refresh) {
        const nextAccess = await refreshAccessToken();
        if (!nextAccess) {
          if (!cancelled) setUser(null);
          if (!cancelled) setIsLoading(false);
          return;
        }
        if (!cancelled) setTokenVersion((v) => v + 1);
      }

      if (!cancelled) {
        setUser(stored);
        setIsLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onCleared = () => {
      setUser(null);
      setTokenVersion((v) => v + 1);
    };
    window.addEventListener("ncs-cms-auth-cleared", onCleared);
    return () => window.removeEventListener("ncs-cms-auth-cleared", onCleared);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await apiLogin(identifier, password);
    if (data.user.role !== "SUPER_ADMIN") {
      clearSession();
      throw new Error("Only Super Admin can access the CMS application.");
    }
    persistSession(data.access_token, data.refresh_token, data.user);
    setUser(data.user);
    setTokenVersion((v) => v + 1);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setTokenVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(
        user && (getAccessToken() || getRefreshToken()),
      ),
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout, tokenVersion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
