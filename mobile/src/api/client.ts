import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const TOKEN_KEY = "session_token";

// expo-secure-store is native-only; fall back to localStorage on web.
const isWeb = Platform.OS === "web";

export const getToken = (): Promise<string | null> =>
  isWeb
    ? Promise.resolve(globalThis.localStorage?.getItem(TOKEN_KEY) ?? null)
    : SecureStore.getItemAsync(TOKEN_KEY);

export const setToken = (t: string): Promise<void> =>
  isWeb
    ? Promise.resolve(globalThis.localStorage?.setItem(TOKEN_KEY, t))
    : SecureStore.setItemAsync(TOKEN_KEY, t);

export const clearToken = (): Promise<void> =>
  isWeb
    ? Promise.resolve(globalThis.localStorage?.removeItem(TOKEN_KEY))
    : SecureStore.deleteItemAsync(TOKEN_KEY);

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error("EXPO_PUBLIC_API_URL is not configured");
  const token = await getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}
