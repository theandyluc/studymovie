// TIP-004 — biến công khai inline lúc build (xem build.mjs `define`).
// CHỈ anon key + URL công khai. KHÔNG service_role.
declare const process: { env: Record<string, string | undefined> };

export const SUPABASE_URL = process.env.SM_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.SM_SUPABASE_ANON_KEY ?? "";
export const SITE_URL = process.env.SM_SITE_URL ?? "http://localhost:3000";
export const BACKEND_URL = process.env.SM_BACKEND_URL ?? "http://localhost:8787";

// Project ref để suy ra key localStorage của web: `sb-<ref>-auth-token`.
export const SUPABASE_REF = (() => {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0];
  } catch {
    return "";
  }
})();
