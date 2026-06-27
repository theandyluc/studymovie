// TIP-003 — Supabase service-role client (CHỈ server-side, KHÔNG bao giờ lên client).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../env.js";

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
