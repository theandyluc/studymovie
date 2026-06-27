// TIP-003 — Gọi backend (NEXT_PUBLIC_BACKEND_URL) kèm Bearer token từ session Supabase.
import { getSupabase } from "./supabaseClient";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new Error(`API ${path} → HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
