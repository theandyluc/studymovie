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
    NEXT_PUBLIC_BLOG_URL: process.env.NEXT_PUBLIC_BLOG_URL,
    NEXT_PUBLIC_PAYWALL_REDIRECT: process.env.NEXT_PUBLIC_PAYWALL_REDIRECT,
  },
  // TIP-019a — Routing tiếng Việt: route cũ tiếng Anh → redirect sang route VN canonical;
  // /ho-tro → redirect ngoài. (Route VN canonical = thư mục page thật, không nhân đôi.)
  // TIP-036: bỏ /blog (khách không dùng blog nữa).
  async redirects() {
    return [
      { source: "/vocabulary", destination: "/tu-vung", permanent: false },
      { source: "/vocabulary/flashcard", destination: "/hoc-tu-vung", permanent: false },
      // Quiz cũ 1 route + ?mode → 2 route VN (vi2en trước vì khớp cụ thể hơn).
      {
        source: "/vocabulary/quiz",
        has: [{ type: "query", key: "mode", value: "vi2en" }],
        destination: "/kiem-tra-viet-anh",
        permanent: false,
      },
      { source: "/vocabulary/quiz", destination: "/kiem-tra-anh-viet", permanent: false },
      { source: "/upgrade", destination: "/thanh-toan", permanent: false },
      // Redirect ngoài
      { source: "/ho-tro", destination: "https://www.facebook.com/thaytruongtienganh", permanent: false },
    ];
  },
};

export default nextConfig;
