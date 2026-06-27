import { cp, mkdir, rm } from "node:fs/promises";
import * as esbuild from "esbuild";

// TIP-001: build skeleton MV3 → extension/dist/ (gitignored).
// Bundle service worker + copy manifest. Content/popup logic thêm ở TIP sau.
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await esbuild.build({
  entryPoints: ["src/background/service-worker.ts"],
  outbase: "src",
  outdir: "dist",
  bundle: true,
  format: "esm",
  target: "chrome110",
  logLevel: "info",
});

await cp("manifest.json", "dist/manifest.json");

console.log("[StudyMovie] extension built → dist/");
