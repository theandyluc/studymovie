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
const nextConfig = {};

export default nextConfig;
