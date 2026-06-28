import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as esbuild from "esbuild";

// TIP-004: build extension MV3 → extension/dist/ (gitignored).
// Bundle 3 entry (background / content auth-bridge / popup) thành IIFE tự chứa,
// copy manifest + popup.html, và INLINE env build-time qua esbuild `define`.
// ⚠️ CHỈ inline anon key + URL công khai — TUYỆT ĐỐI KHÔNG service_role.

const here = dirname(fileURLToPath(import.meta.url));

// Đọc biến công khai từ root .env (giữ 1 nguồn duy nhất).
async function readRootEnv() {
  const env = {};
  try {
    const txt = await readFile(resolve(here, "../.env"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].replace(/\s+#.*$/, "").trim();
    }
  } catch {
    /* dựa vào process.env nếu không có file */
  }
  return env;
}

const e = await readRootEnv();
const pick = (k, fallback = "") => e[k] ?? process.env[k] ?? fallback;

const define = {
  "process.env.NODE_ENV": JSON.stringify("production"),
  "process.env.SM_SUPABASE_URL": JSON.stringify(pick("NEXT_PUBLIC_SUPABASE_URL", pick("SUPABASE_URL"))),
  "process.env.SM_SUPABASE_ANON_KEY": JSON.stringify(pick("NEXT_PUBLIC_SUPABASE_ANON_KEY", pick("SUPABASE_ANON_KEY"))),
  "process.env.SM_SITE_URL": JSON.stringify(pick("NEXT_PUBLIC_SITE_URL", "http://localhost:3000")),
  "process.env.SM_BACKEND_URL": JSON.stringify(pick("NEXT_PUBLIC_BACKEND_URL", "http://localhost:8787")),
};

// Chốt chặn an toàn: không bao giờ để service_role lọt vào define.
for (const [k, v] of Object.entries(define)) {
  if (/service_role/i.test(k) || /service_role/i.test(String(v))) {
    throw new Error(`Phát hiện service_role trong define (${k}) — DỪNG build.`);
  }
}

await rm("dist", { recursive: true, force: true });
await mkdir("dist/popup", { recursive: true });

await esbuild.build({
  entryPoints: [
    "src/background/service-worker.ts",
    "src/content/auth-bridge.ts",
    "src/content/youtube.ts",
    "src/content/yt-intercept.ts",
    "src/content/timer.ts",
    "src/popup/popup.ts",
  ],
  outbase: "src",
  outdir: "dist",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome110",
  define,
  logLevel: "info",
});

await cp("manifest.json", "dist/manifest.json");
await cp("src/popup/popup.html", "dist/popup/popup.html");

console.log("[StudyMovie] extension built → dist/ (background + content + popup)");
