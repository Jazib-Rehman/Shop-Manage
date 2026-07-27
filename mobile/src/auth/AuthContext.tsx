import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, clearToken, getToken, setToken } from "../api/client";

type AuthState = {
  ready: boolean;
  authed: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  forgot: (email: string) => Promise<string>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    getToken().then((t) => {
      setAuthed(!!t);
      setReady(true);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token } = await api<{ token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await setToken(token);
    setAuthed(true);
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const { token } = await api<{ token: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await setToken(token);
    setAuthed(true);
  }, []);

  const forgot = useCallback(async (email: string) => {
    const { message } = await api<{ message?: string }>("/api/auth/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return message || "If that email is registered, a reset link was sent.";
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setAuthed(false);
  }, []);

  return (
    <AuthContext.Provider value={{ ready, authed, login, signup, forgot, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
