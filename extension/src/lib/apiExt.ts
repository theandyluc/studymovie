// TIP-004 — gọi backend kèm Bearer access_token (tự refresh qua getSession).
import { supabaseExt } from "./supabaseExt";
import { BACKEND_URL } from "./env";

export async function apiExt<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  // getSession() tự refresh nếu access_token đã hết hạn (dùng refresh_token).
  const { data } = await supabaseExt.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${BACKEND_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new Error(`API ${path} → HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
