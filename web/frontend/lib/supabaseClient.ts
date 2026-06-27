// TIP-003 — Supabase browser client (CHỈ anon key, chạy phía client).
// TUYỆT ĐỐI không dùng service_role ở client.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let warned = false;

/** Trả singleton browser client, hoặc null nếu chưa cấu hình env (để UI không crash). */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    if (!warned && typeof console !== "undefined") {
      warned = true;
      console.warn(
        "[StudyMovie] Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (root .env)."
      );
    }
    return null;
  }
  client = createClient(url, anon, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
