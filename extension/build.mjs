import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as esbuild from "esbuild";

// TIP-004: build extension MV3 → extension/dist/ (gitignored).
// Bundle 3 entry (background / content auth-bridge / popup) thành IIFE tự chứa,
// copy manifest + popup.html, và INLINE env build-time qua esbuild `define`.
// ⚠️ CHỈ inline anon key + URL công khai — TUYỆT ĐỐI KHÔNG service_role.

const here = dirname(fileURLToPath(import.meta.url));

// --prod: build bản production, đọc extension/.env.production (trỏ về URL Vercel).
// mặc định (dev): đọc root .env (trỏ localhost). Giữ được CẢ 2 bản.
// --watch: TIP-085 — esbuild tự build lại mỗi khi lưu file trong src/ (npm run dev). Vẫn phải
// tự bấm "reload" ở chrome://extensions sau mỗi lần build xong (Chrome không tự nạp lại được).
const PROD = process.argv.includes("--prod");
const WATCH = process.argv.includes("--watch");
const ENV_FILE = PROD ? resolve(here, ".env.production") : resolve(here, "../.env");

async function readEnvFile() {
  const env = {};
  try {
    const txt = await readFile(ENV_FILE, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].replace(/\s+#.*$/, "").trim();
    }
  } catch {
    /* dựa vào process.env nếu không có file */
  }
  return env;
}

const e = await readEnvFile();
console.log(`[StudyMovie] build ${PROD ? "PRODUCTION (.env.production)" : "dev (root .env)"}`);
const pick = (k, fallback = "") => e[k] ?? process.env[k] ?? fallback;

const smSupabaseUrl = pick("NEXT_PUBLIC_SUPABASE_URL", pick("SUPABASE_URL"));
if (!smSupabaseUrl) {
  console.warn(
    `[StudyMovie] ⚠️  SUPABASE_URL rỗng — thiếu file ${ENV_FILE}. Popup sẽ crash ngay lúc load ` +
      `("supabaseUrl is required") và kẹt ở "Đang tải…" tĩnh. Dùng \`npm run build:prod\` (đọc ` +
      `.env.production) hoặc tạo root .env trước khi build dev.`
  );
}

const define = {
  "process.env.NODE_ENV": JSON.stringify("production"),
  "process.env.SM_SUPABASE_URL": JSON.stringify(smSupabaseUrl),
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

const buildOptions = {
  entryPoints: [
    "src/background/service-worker.ts",
    "src/content/auth-bridge.ts",
    "src/content/youtube.ts",
    "src/content/yt-intercept.ts",
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
};

if (WATCH) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("[StudyMovie] watch mode — đang theo dõi src/, tự build lại khi lưu file (Ctrl+C để dừng).");
  console.log("[StudyMovie] sau mỗi lần build lại, vào chrome://extensions bấm reload để nạp bản mới.");
} else {
  await esbuild.build(buildOptions);
}

// TIP-031 WI-4 — bản PROD (store): loại mọi entry chứa "localhost" khỏi host_permissions
// và content_scripts[*].matches (Chrome Web Store không chấp nhận localhost). Bản dev GIỮ nguyên.
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
if (PROD) {
  const noLocalhost = (arr) => (Array.isArray(arr) ? arr.filter((m) => !/localhost/.test(m)) : arr);
  if (manifest.host_permissions) manifest.host_permissions = noLocalhost(manifest.host_permissions);
  if (Array.isArray(manifest.content_scripts)) {
    for (const cs of manifest.content_scripts) {
      if (cs.matches) cs.matches = noLocalhost(cs.matches);
    }
  }
}
await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));
await cp("src/popup/popup.html", "dist/popup/popup.html");

// TIP-031 WI-3 — copy 3 icon (16/48/128) vào dist (cả dev lẫn prod). KHÔNG copy logo.png nguồn.
await mkdir("dist/icons", { recursive: true });
for (const size of [16, 48, 128]) {
  await cp(`icons/icon-${size}.png`, `dist/icons/icon-${size}.png`);
}

console.log("[StudyMovie] extension built → dist/ (background + content + popup)");
