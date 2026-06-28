# claude-progress.md — StudyMovie

> Nhật ký từng session. Mỗi session đọc file này TRƯỚC khi làm, và ghi 1 entry mới ở CUỐI.
> Mục tiêu: session sau pick up đúng chỗ session trước dừng. Mới nhất ở trên cùng.

---

## Trạng thái tổng quan

- **Giai đoạn hiện tại:** GĐ2 — web dashboard/settings/leaderboard xong (TIP-007 done: WEB-02/07/09)
- **Feature đang làm:** (chưa bắt đầu TIP tiếp theo)
- **Next:** còn lại theo Task Graph — extension timer EXT-03 (study_sessions, sinh dữ liệu giờ cho dashboard/leaderboard), web /playlist (WEB-06), /upgrade thật (WEB-08, VietQR+SePay BE-04/05).
- **Blocker / cần làm:** (1) ⚠️ **Homeowner test extension trên Chrome thật** (load unpacked `extension/dist/` → login → nhận session → trạng thái trial). (2) ⚠️ **ĐỔI mật khẩu DB Supabase** (lộ ở TIP-002). (3) Production: thêm domain `https://studymovie.com/*` vào manifest host_permissions + content_scripts matches (hiện chỉ localhost:3000). (4) Khách chốt UI streak "hôm nay chưa đạt".

---

## Session log

### Session 7 — TIP-007 Dashboard + Settings + Leaderboard (2026-06-27)
- **TIP/Feature:** TIP-007 — WEB-02 (dashboard), WEB-09 (settings), WEB-07 (leaderboard). KHÔNG sửa RPC (chỉ gọi).
- **Đã làm:**
  - **Backend:** `getUserClient(token)` (anon + Authorization header → RPC có auth.uid; service_role không có); middleware lưu `token`. Endpoint: `GET /api/dashboard` (rpc get_dashboard), `GET /api/leaderboard` (rpc get_leaderboard_weekly), `GET`+`PATCH /api/profile` (nickname/daily_commit_minutes). Wire app.ts.
  - **`lib/account.ts`**: types + fetchers (dashboard/leaderboard/profile/me) + subscriptionText.
  - **`app/dashboard`** (thay placeholder TIP-003): streak (lửa sáng/xám theo today_met) + progress X/Y + biểu đồ cột tuần/tháng (CSS div, KHÔNG thêm chart lib) + zero-state.
  - **`app/settings`**: đổi nickname + phút cam kết (PATCH), xem subscription (read), Đăng xuất, **credit từ điển FVDP GPL v2 + link** (bắt buộc license).
  - **`app/leaderboard`**: top tuần ISO + avatar + nickname + giờ, 🥇🥈🥉, highlight 'bạn', ghim caller ngoài top, ghi chú reset thứ Hai.
  - Bật nav Dashboard/Bảng xếp hạng/Cài đặt trong Header.
- **Verification:**
  - `init.sh` exit 0 (lint+typecheck 3 pkg). FE build OK — route /dashboard, /leaderboard, /settings prerender.
  - **`verify_account.mjs` 9/9 PASS** (401; dashboard streak=1/met/min=35/week7/month30; profile GET/PATCH/reload; leaderboard 2 user B>A + caller).
  - **AC-7:** RPC/migrations (supabase/) KHÔNG đụng; frontend không service_role.
- **Còn dở / chưa verify (Homeowner browser):** UI dashboard/settings/leaderboard. Leaderboard cần >1 user để thấy xếp hạng (verify đã chứng minh logic bằng 2 user tạm).
- **Deviation:** (1) Phải thêm `getUserClient` (JWT user) vì RPC dùng auth.uid — service_role không gọi được. (2) Biểu đồ bằng CSS div (không thêm thư viện). (3) Sửa feature_list WEB-02/07/09 tip TIP-005→TIP-007.
- **Cách resume:** `npm run dev` backend+frontend → đăng nhập → /dashboard, /settings, /leaderboard. Dashboard/leaderboard cần study_sessions (sinh qua extension timer EXT-03 — TIP sau).
- **Commit:** feat(web): TIP-007 dashboard + settings + leaderboard.

### Session 6 — TIP-006 Web Vocabulary (list + xóa + flashcard + quiz) (2026-06-27)
- **TIP/Feature:** TIP-006 — WEB-03 (list+xóa), WEB-04 (flashcard), WEB-05 (quiz 2 chiều). Thiết kế chốt: học TẤT CẢ từ (không tick) + cho xóa.
- **Đã làm:**
  - **Backend:** `GET /api/vocabulary` (list user, desc), `DELETE /api/vocabulary/:id` (chỉ của user — eq user_id). Wire `app.ts`.
  - **`lib/vocabulary.ts`** (logic tách khỏi UI): fetchVocab, deleteVocab, quizableItems, buildQuiz (en2vi/vi2en, 3 distractor random distinct từ vocab user, max 20), shuffle.
  - **`app/vocabulary/page.tsx`**: list (word/IPA/nghĩa/example/🔊) + Xóa (confirm + optimistic) + 3 nút điều hướng + empty state. Bật nav 'Từ vựng' trong Header.
  - **`app/vocabulary/flashcard`**: lật thẻ, Trước/Sau, đếm vị trí, audio, empty state.
  - **`app/vocabulary/quiz`**: en2vi/vi2en (đọc mode từ query qua window.location — tránh Suspense), 4 đáp án, chấm điểm + kết quả, <4 từ → chặn có thông báo (AC-7).
- **Verification:**
  - `init.sh` exit 0 (lint+typecheck cả 3). FE build OK — route /vocabulary, /vocabulary/flashcard, /vocabulary/quiz prerender sạch.
  - **`verify_vocab.mjs` 10/10 PASS** (lookup, save, dup, list chứa từ, GET 401, DELETE id lạ→false, DELETE thật→true, list sau xóa rỗng).
  - **AC-9:** frontend không dùng service_role (chỉ NEXT_PUBLIC + apiClient anon).
- **Còn dở / chưa verify (Homeowner test browser):** AC-1..7 UI (list/xóa/flashcard/quiz) — cần đăng nhập + dev server; quiz cần ≥4 từ.
- **Deviation:** Sửa `feature_list` WEB-03/04/05 tip TIP-004→TIP-006 + acceptance bỏ 'tick' theo thiết kế chốt (Blueprint v1.4 đã cập nhật).
- **Cách resume:** `npm run dev` backend+frontend → đăng nhập → /vocabulary. Quiz cần ≥4 từ (lưu thêm qua extension nếu thiếu).
- **Commit:** feat(web): TIP-006 vocabulary list + flashcard + quiz.

### Session 5 — TIP-005 Dual subtitle + click-word lookup + settings (2026-06-27)
- **TIP/Feature:** TIP-005 — EXT-01 (phụ đề song ngữ), EXT-02 (click-từ tra/lưu), EXT-04 (settings).
- **Đã làm:**
  - **Backend:** `GET /api/lookup?word=` (RPC lookup_word), `POST /api/vocabulary` (upsert idempotent UNIQUE user_id,word) — protected, CORS đã cho chrome-extension.
  - **Extension `lib/captions.ts`:** đọc captionTracks từ `ytInitialPlayerResponse` (fetch lại trang watch cùng origin) → EN track gốc + `fmt=json3`; VI = cùng baseUrl + `tlang=vi` (auto-translate, D-1). Brace-matching extractor an toàn. Không caption → trả [] (fallback).
  - **Extension `lib/settings.ts`:** chrome.storage.local + defaults + onSettingsChange.
  - **Extension `content/youtube.ts`:** overlay 2 dòng EN/VI trong #movie_player, sync currentTime (interval 250ms), re-init khi đổi video (yt-navigate-finish + poll). Click từ EN → pause + giữ phụ đề → lookup popup (lemma/IPA/nghĩa/audio/Lưu) → POST vocabulary (example=câu EN) → click ngoài/Đóng → play. Gear 📖 → panel settings realtime (bật/tắt, mode, cỡ chữ, màu chữ, màu/độ mờ nền). Ẩn caption gốc YouTube.
  - Manifest + build.mjs: thêm content script youtube (`*://*.youtube.com/*`).
- **Verification (tự test được):**
  - `init.sh` exit 0 (lint+typecheck cả 3). Extension build dist OK (thêm youtube.js).
  - **Backend e2e `verify_vocab.mjs` 5/5 PASS** (lookup('running') 200, save vocab+example, lưu trùng không lỗi duplicate=true, DB đúng 1 dòng, 401 không token).
  - **AC-8:** service_role KHÔNG có trong bundle dist.
- **Còn dở / chưa verify (Homeowner test Chrome):** AC-1/2/3 (overlay song ngữ + fallback + tlang=vi), AC-4 (click pause+popup), AC-6 (settings realtime) — cần video YouTube có caption EN. Không tự test YouTube DOM/timedtext ở môi trường Thợ.
- **Deviation / rủi ro:** (1) tip EXT-01/02/04 sửa TIP-008/009→TIP-005 cho khớp. (2) Audio Free Dictionary API CHƯA tích hợp (audio_url từ dict null → nút audio chỉ hiện khi có) — bổ sung sau. (3) ⚠️ YouTube timedtext/ytInitialPlayerResponse là endpoint không chính thức, có thể đổi/chặn (Blueprint mục 0 đã ghi) — nếu Homeowner test thấy không lấy được caption, cần điều tra phương án (player API nội bộ). (4) youtube.js bundle ~772KB (kèm supabase-js) — chấp nhận, có thể tối giản sau.
- **Cách resume:** `npm run build --prefix extension` → reload extension → mở video YouTube có CC tiếng Anh (vd TED) → kiểm overlay/click/settings. Backend+frontend dev chạy.
- **Commit:** feat(ext): TIP-005 dual subtitle + click-word lookup + settings.
- **Debug (cùng ngày, sau test Chrome — 3 vòng):**
  1. **Caption rỗng:** timedtext baseUrl từ ytInitialPlayerResponse THIẾU chữ ký (`pot`) → 0 byte. Fix: `content/yt-intercept.ts` (MAIN world, document_start) hook fetch/XHR bắt **URL đã ký player tự gọi** → fetch json3 EN + `tlang=vi` VI → postMessage cue sang content. (`captions.ts` rút còn helper parse.)
  2. **Click-từ "Failed to fetch":** content (origin youtube.com) bị CORS chặn. Fix (Cách 2 chuẩn MV3): route qua **background SW** (`SM_API` → apiExt origin chrome-extension đã được CORS); **CORS backend giữ chặt**. Lợi phụ: youtube.js 769KB→15KB.
  3. **SPA đổi video không cập nhật:** race do dựa `yt-navigate-finish`. Fix: message-driven theo `videoId` + poll `location` xoá stale, dựng lại overlay vào `#movie_player` hiện tại.
  - Đã test Chrome: phụ đề EN/VI, click/lookup/lưu/resume, settings realtime, SPA đổi video — tất cả OK.

### Session 4 — TIP-004 Extension MV3 foundation + shared-session auth + trial check (2026-06-27)
- **TIP/Feature:** TIP-004 — EXT-05-06-07 (login shared session, trạng thái subscription, upgrade redirect).
- **Đã làm:**
  - **Manifest MV3** nâng cấp: permissions storage/tabs/scripting, host youtube + localhost:3000; background SW + popup + content auth-bridge.
  - **Build** `extension/build.mjs`: esbuild bundle 3 entry (IIFE) + copy manifest/popup.html + inline env build-time (anon/site/backend, có chốt chặn KHÔNG service_role).
  - **Shared-session auth:** `content/auth-bridge.ts` (poll localStorage web `sb-<ref>-auth-token` → sendMessage), `background/service-worker.ts` (setSession vào chrome.storage qua `supabaseExt`), `lib/supabaseExt.ts` (chrome.storage adapter + autoRefreshToken, anon), `lib/apiExt.ts` (Bearer + getSession auto-refresh), `lib/env.ts`.
  - **Popup** `popup.html`+`popup.ts` (vanilla TS): chưa login→nút mở web; đã login→avatar+email (EXT-05)+trạng thái sub (EXT-06)+nút Nâng cấp khi hết hạn (EXT-07)+logout; tự cập nhật qua `chrome.storage.onChanged`.
  - **Backend:** `/api/me` trả thêm `subscription` + `is_active` (tính server-side theo now()). `/upgrade` placeholder (web).
- **Verification:**
  - `init.sh` exit 0 (lint+typecheck cả 3). Extension `npm run build` → dist hợp lệ (manifest MV3, background/content/popup + popup.html).
  - **AC-8:** service_role KHÔNG có trong bundle dist (anon có — đúng). 
  - BE `vitest` 3 pass. `verify_auth.mjs` **8/8 PASS** (401/200/profile/subscription trial/`is_active=true` server-side/CORS).
- **Còn dở / chưa verify (Homeowner test Chrome):** AC-1 load unpacked, AC-2 bridge nhận session sau login web, AC-3 hiển thị trạng thái, AC-4 nút Nâng cấp, AC-5 token refresh, AC-6 logout. (Logic đã build sạch; cần Chrome thật.)
- **Deviation:** (1) Sửa `feature_list` EXT-05-06-07 tip TIP-007→TIP-004 cho khớp thực tế. (2) Content YouTube (check hạn mỗi lần vào YouTube + ẩn sub) để TIP-005 — TIP-004 làm nền tảng + popup + server-side check.
- **Cách resume:** Homeowner: `chrome://extensions` → Developer mode → Load unpacked `extension/dist/` (sau `npm run build --prefix extension`). Backend + frontend chạy dev. Đăng nhập web → kiểm popup extension.
- **Commit:** feat(ext): TIP-004 MV3 foundation + shared-session auth + trial check.

### Session 3 — TIP-003 Web auth foundation + design base (2026-06-27)
- **TIP/Feature:** TIP-003 — WEB-01 (login Google) + nền tảng auth/design cho mọi trang web.
- **Đã làm:**
  - **Design base (Hướng B):** tokens tập trung Tailwind v4 `@theme` trong `app/globals.css` (màu/font/radius/shadow — đánh dấu PLACEHOLDER, reskin theo Figma). App shell: `app/layout.tsx` + `components/Header.tsx` (logo, nav placeholder, avatar+tên+Đăng xuất). UI primitives `components/ui/` (Button/Card/Avatar/Spinner).
  - **Auth FE:** `lib/supabaseClient.ts` (browser, anon, PKCE, singleton), `lib/apiClient.ts` (gắn Bearer), `hooks/useUser.ts`, `app/page.tsx` login Google, `app/auth/callback` exchangeCodeForSession, `app/dashboard` protected (`components/AuthGuard.tsx`), logout.
  - **Auth BE:** `src/env.ts` (nạp root .env), `src/lib/supabase.ts` (service client), `src/middleware/auth.ts` (`requireAuth` → `getUser(token)`), `src/api/me.ts` (`GET /api/me`), CORS chỉ `SITE_URL` trong `src/app.ts`.
  - **Env:** thêm `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` vào `.env.example`; frontend nạp root `.env` qua `next.config.mjs`. Deps: `@supabase/supabase-js` cho cả 2 workspace.
- **Verification:**
  - `init.sh` exit 0 — lint+typecheck sạch cả 3 package.
  - FE `next build` OK (4 routes: / · /auth/callback · /dashboard · /_not-found).
  - BE `vitest` 3 pass (health + /api/me 401 × 2).
  - `verify_auth.mjs` (server thật + user tạm): **6/6 PASS** — /api/me 401 (không/sai token), 200 + đúng user + profile, CORS chặn origin lạ. User tạm đã xoá.
  - AC-7: client KHÔNG dùng service_role (chỉ NEXT_PUBLIC_*); `.env` không track.
- **Còn dở / chưa verify (cần Homeowner):** AC-3/4/5 — login Google THẬT qua browser: cần Homeowner (1) thêm 2 biến `NEXT_PUBLIC_SUPABASE_*` vào root `.env`, (2) đăng nhập thật. Logic protected-redirect/logout đã code + build OK.
- **Deviation:** Frontend nạp root `.env` qua `next.config.mjs` (thay vì để 2 biến ở `web/frontend/.env.local`) để giữ MỘT nguồn `.env` duy nhất.
- **Cách resume:** Homeowner thêm 2 biến NEXT_PUBLIC → `npm run dev` (frontend + backend) → login Google. Tiếp TIP-004.
- **Commit:** feat(web): TIP-003 auth foundation + design base.

### Session 2 — TIP-002 Data layer (2026-06-27)
- **TIP/Feature:** TIP-002 — BE-02 (schema+RLS) + BE-03 (RPC core) + BE-06 (import từ điển).
- **Đã làm:**
  - Supabase CLI (devDep `supabase`) + `supabase init` → `supabase/config.toml`.
  - `supabase/migrations/20260627000001_init_schema.sql`: 6 bảng (Blueprint mục 3) + RLS cả 6 bảng + policy auth.uid()=user_id (profiles=id) + dictionary read-only authenticated + GRANT + trigger `on_auth_user_created` (auth.users → profiles + subscriptions trial +24h).
  - `supabase/migrations/20260627000002_rpc.sql`: lookup_word (lemmatize), today_minutes(p_user_id), get_dashboard (streak Duolingo UTC+7 + today_met + week/month), get_leaderboard_weekly (tuần ISO compute-on-read). SECURITY DEFINER + guard.
  - `supabase/seed/import_dictionary.mjs` (FVDP © Hồ Ngọc Đức, free, cần credit) + `supabase/seed/verify_rpc.mjs` (seed test + verify, tự dọn user tạm).
  - Deps: thêm `supabase` + `@supabase/supabase-js` (root devDep). `pg` chỉ cài `--no-save` để introspect, KHÔNG commit.
- **Verification:**
  - `supabase db push` qua session pooler aws-1-ap-southeast-1 (port 5432) → 2 migration applied OK (exit 0).
  - Introspect (pg): 6 bảng, RLS cả 6, policy/constraint/FK đúng, 5 function SECURITY DEFINER.
  - `import_dictionary.mjs` → dictionary **103,401 dòng**.
  - `verify_rpc.mjs` → **13/13 PASS** (trigger, streak=3, today_met, today_minutes=35, guard, leaderboard, lookup_word, RLS isolation). User tạm đã xoá.
- **Còn dở / chưa verify:** Backend Hono CHƯA có endpoint nghiệp vụ (đúng scope — chỉ /health). BE-03 chờ Chủ thầu duyệt → `verified`.
- **Deviation:** (1) minhqnd/dictionary repo rỗng → dùng FVDP qua mirror manhminno (ghi credit). (2) Áp migration bằng `supabase db push --db-url` (session pooler) thay vì `supabase link` (link cần `supabase login` tương tác — không chạy được trong shell non-interactive; MCP Supabase chưa có access token). Migration history remote đã cập nhật → `db push` sau khi link vẫn in-sync. (3) Mật khẩu DB nhận qua chat (không qua terminal như TIP) → KHÔNG ghi vào file; cần rotate.
- **Cách resume:** `./init.sh` → migrations đã ở cloud. Chạy lại verify: `node --env-file=.env supabase/seed/verify_rpc.mjs`. Re-import: `node --env-file=.env supabase/seed/import_dictionary.mjs`.
- **Commit:** feat(db): TIP-002 schema + RLS + RPC + dictionary import.

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
