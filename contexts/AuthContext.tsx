"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loginWithEmpCode } from "@/services/api";
import type { Profile } from "@/types/profile";

const STORAGE_KEY = "report-design.auth.user";
// Bump when the Profile shape changes incompatibly so old persisted blobs
// are discarded on next load instead of feeding stale data into the app.
const STORAGE_VERSION = 2;

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: Profile | null;
}

interface AuthContextValue extends AuthState {
  login: (empCode: string, password: string) => Promise<Profile>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface PersistedAuth {
  version: number;
  user: Profile;
}

function readPersisted(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedAuth> | Profile;
    // Old format (the bare Profile) is deliberately rejected so users with a
    // stale "email/password" blob get a clean login screen.
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as PersistedAuth).version !== STORAGE_VERSION ||
      !(parsed as PersistedAuth).user?.userId ||
      !(parsed as PersistedAuth).user?.role
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return (parsed as PersistedAuth).user;
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function writePersisted(user: Profile | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      const payload: PersistedAuth = { version: STORAGE_VERSION, user };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore quota / privacy-mode failures */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start in "loading" so SSR + the very first client render agree on a
  // single shape; the useEffect below hydrates from localStorage on mount.
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
  });

  useEffect(() => {
    // Hydrate from localStorage exactly once on mount. We deliberately keep
    // the initial state as "loading" (instead of computing it lazily in
    // useState) so SSR and the first client render match — otherwise the
    // server, which has no localStorage, would render "unauthenticated"
    // while the client renders "authenticated" and React would complain
    // about a hydration mismatch.
    const restored = readPersisted();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(
      restored
        ? { status: "authenticated", user: restored }
        : { status: "unauthenticated", user: null }
    );
  }, []);

  const login = useCallback(
    async (empCode: string, password: string) => {
      const user = await loginWithEmpCode(empCode, password);
      writePersisted(user);
      setState({ status: "authenticated", user });
      return user;
    },
    []
  );

  const logout = useCallback(() => {
    writePersisted(null);
    setState({ status: "unauthenticated", user: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      login,
      logout,
    }),
    [state, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
