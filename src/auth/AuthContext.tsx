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

  useEffect(() => {
    const stored = loadStoredUser();
    const token = getAccessToken();
    const refresh = getRefreshToken();
    if (stored && (token || refresh) && stored.role === "SUPER_ADMIN") {
      setUser(stored);
    } else {
      clearSession();
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await apiLogin(identifier, password);
    if (data.user.role !== "SUPER_ADMIN") {
      clearSession();
      throw new Error("Only Super Admin can access the CMS application.");
    }
    persistSession(data.access_token, data.refresh_token, data.user);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user && (getAccessToken() || getRefreshToken())),
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
