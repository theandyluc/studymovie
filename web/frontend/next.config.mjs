import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Tải .env ở ROOT monorepo để NEXT_PUBLIC_* có MỘT nguồn duy nhất (root .env).
// (Next mặc định chỉ đọc .env trong web/frontend; ở đây ta nạp thêm từ root.)
try {
  const here = dirname(fileURLToPath(import.meta.url));
  const txt = readFileSync(resolve(here, "../../.env"), "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/\s+#.*$/, "").trim();
    }
  }
} catch {
  // không có root .env -> dựa vào .env của Next / platform
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ép inline các biến NEXT_PUBLIC_* (đã nạp từ root .env ở trên) vào bundle client.
  // Cần khoá `env` này vì Next KHÔNG tự inline biến chỉ được set qua process.env trong
  // next.config — nó chỉ tự inline từ file .env trong thư mục Next. Giữ root .env là nguồn duy nhất.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
};

export default nextConfig;
