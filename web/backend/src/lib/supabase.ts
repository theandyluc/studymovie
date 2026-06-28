// TIP-003 — Supabase service-role client (CHỈ server-side, KHÔNG bao giờ lên client).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from "../env.js";

let client: SupabaseClient | undefined;

export function getServiceClient(): SupabaseClient {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ở backend (.env root).");
  }
  client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// TIP-007 — client gắn JWT của user (anon key + Authorization) để RPC có auth.uid()
// (get_dashboard/get_leaderboard_weekly yêu cầu auth.uid; service_role không có).
export function getUserClient(token: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Thiếu SUPABASE_URL / SUPABASE_ANON_KEY ở backend (.env root).");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
