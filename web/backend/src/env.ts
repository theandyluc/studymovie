// TIP-003 — Tải biến môi trường cho backend.
// Dev: đọc .env ở ROOT monorepo (một nguồn duy nhất) nếu chưa có sẵn trong process.env.
// Prod/serverless: dùng env do platform inject (Vercel...) → bỏ qua đọc file.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

function loadRootEnv(): void {
  if (process.env.SUPABASE_URL) return; // đã có (platform hoặc --env-file)
  try {
    const here = dirname(fileURLToPath(import.meta.url)); // web/backend/src
    const envPath = resolve(here, "../../../.env"); // -> repo root
    const txt = readFileSync(envPath, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/\s+#.*$/, "").trim();
      }
    }
  } catch {
    // không có file .env -> dựa vào platform env
  }
}
loadRootEnv();

export const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const PORT = Number(process.env.PORT ?? 8787);

// TIP-013 — Thanh toán Pro (VietQR + SePay). Giá trị thật set ở Vercel env, KHÔNG commit.
export const SEPAY_API_KEY = process.env.SEPAY_API_KEY ?? "";
export const BANK_ID = process.env.BANK_ID ?? ""; // mã ngân hàng VietQR (vd "MB", "970422"...)
export const BANK_ACCOUNT_NO = process.env.BANK_ACCOUNT_NO ?? "";
export const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME ?? "";
export const VIETQR_TEMPLATE = process.env.VIETQR_TEMPLATE ?? "compact2"; // mẫu ảnh VietQR
export const PRO_PRICE = Number(process.env.PRO_PRICE ?? 49000);
export const PRO_DURATION_DAYS = Number(process.env.PRO_DURATION_DAYS ?? 30);

// TIP-038 — OpenAI (gpt-4o-mini) cho nghĩa theo ngữ cảnh. CHỈ backend. Trống = tắt tính năng (fallback từ điển).
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
