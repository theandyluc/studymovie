# claude-progress.md — StudyMovie

> Nhật ký từng session. Mỗi session đọc file này TRƯỚC khi làm, và ghi 1 entry mới ở CUỐI.
> Mục tiêu: session sau pick up đúng chỗ session trước dừng. Mới nhất ở trên cùng.

---

## Trạng thái tổng quan

- **Giai đoạn hiện tại:** GĐ1 — scaffold xong (TIP-001 done)
- **Feature đang làm:** (chưa bắt đầu TIP tiếp theo)
- **Next:** TIP-002 (BE-02) — data layer: schema + RLS + seed + import từ điển EN-VI. **Cần Human setup trước:** Supabase project (Singapore) + Google OAuth + điền `.env`.
- **Blocker:** Chờ Human tạo Supabase project (Singapore) + Google OAuth credentials cho TIP-002. Vẫn còn: khách chốt streak hiển thị khi "hôm nay chưa đạt".

---

## Session log

### Session 1 — TIP-001 Scaffold monorepo (2026-06-27)
- **TIP/Feature:** TIP-001 — INF-01 scaffold monorepo (npm workspaces).
- **Đã làm:** Dựng skeleton 3 package + supabase/migrations rỗng.
  - Root `package.json`: npm workspaces + scripts tổng (lint/typecheck/build/test, `--workspaces --if-present`), engine node>=20.
  - `web/frontend`: Next 15.5 (App Router) + React 19 + TS strict + Tailwind v4 (@tailwindcss/postcss). 1 trang placeholder "StudyMovie — frontend OK".
  - `web/backend`: Hono + @hono/node-server, dev qua tsx, test qua Vitest. 1 route `GET /health` → `{status:"ok"}`. Dir rỗng api/services/repositories/integrations (.gitkeep).
  - `extension`: MV3 manifest (host youtube), build esbuild → dist/. service-worker.ts chỉ log init. Dir content/popup/lib (.gitkeep).
  - ESLint: thống nhất ESLint 9 flat config + typescript-eslint cho cả 3 (tránh xung đột version giữa workspaces).
- **Verification:** init.sh **exit 0** (install ✓×3, lint ✓×3, typecheck ✓×3, không ✗). FE `next build` OK + `next dev` Ready → `GET /` HTTP 200. BE server thật `GET /health` → 200 `{"status":"ok"}` + `vitest run` 1 pass. EXT `npm run build` → dist/manifest.json (manifest_version=3) + background/service-worker.js. git: node_modules/.next/dist/next-env.d.ts đều ignored, chỉ `.env.example` được track.
- **Còn dở / chưa verify:** Supabase project (Singapore) + Google OAuth + `.env` = **Human setup** (ngoài scope Thợ) — chưa làm, là tiền đề cho TIP-002.
- **Deviation:** Frontend dùng `eslint .` + typescript-eslint flat thay vì `next lint`/eslint-config-next (thống nhất version, lint sạch). Có thể bổ sung eslint-config-next sau.
- **Cách resume:** `./init.sh` (exit 0) → Human hoàn tất Supabase Singapore + Google OAuth + `.env` → bắt đầu TIP-002 (data layer).
- **Commit:** feat(scaffold): TIP-001 monorepo (frontend Next + backend Hono + extension MV3).

### Session 0 — Khởi tạo harness (template)
- **Đã làm:** Dựng harness (CLAUDE.md, feature_list.json, claude-progress.md, init.sh) từ Blueprint v1.4. Chưa có code.
- **Còn dở:** Toàn bộ feature ở trạng thái `todo`.
- **Cách resume:** Đọc CLAUDE.md → chạy `./init.sh` → bắt đầu TIP-001 (INF-01).
- **Ghi chú:** Nhớ chọn Supabase region **Singapore** ngay khi tạo project (transfer Cách B yêu cầu cùng region).

<!--
MẪU ENTRY cho session sau (copy lên đầu Session log):

### Session N — <tiêu đề ngắn> (YYYY-MM-DD)
- **TIP/Feature:** <id> — <title>
- **Đã làm:** <tóm tắt>
- **Verification:** <lệnh đã chạy + kết quả: lint/typecheck/test/qa>
- **Còn dở / chưa verify:** <điểm cần làm tiếp>
- **Quyết định mới (nếu có):** <ghi nếu có thay đổi cần ghi vào Blueprint>
- **Cách resume:** <bước cụ thể để session sau tiếp tục>
- **Commit:** <hash / mô tả>
-->
