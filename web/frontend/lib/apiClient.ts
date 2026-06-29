// TIP-003 — Gọi backend (NEXT_PUBLIC_BACKEND_URL) kèm Bearer token từ session Supabase.
import { getSupabase } from "./supabaseClient";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

// Lỗi API mang theo status + code (body.error) để UI map sang thông báo thân thiện.
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code?: string) {
    super(code ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

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
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") code = body.error;
    } catch {
      /* body không phải JSON */
    }
    throw new ApiError(res.status, code);
  }
  return (await res.json()) as T;
}
