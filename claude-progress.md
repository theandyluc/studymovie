# claude-progress.md — StudyMovie

> Nhật ký từng session. Mỗi session đọc file này TRƯỚC khi làm, và ghi 1 entry mới ở CUỐI.
> Mục tiêu: session sau pick up đúng chỗ session trước dừng. Mới nhất ở trên cùng.

---

## Trạng thái tổng quan

- **Giai đoạn hiện tại:** TIP-014 **VERIFIED** — timer extension THỦ CÔNG Start/Stop (AC-1→5 PASS Chrome) + streak >10 phút (migration 005 đã áp production, co_600=true).
- **Feature đang làm:** (chưa bắt đầu TIP tiếp theo)
- **Next:** QA-01 (QA tổng), INF-02 (đóng gói extension Chrome Web Store + HANDOVER.md + transfer ownership).
- **LƯU Ý KỸ THUẬT (quan trọng):** Vercel serverless đọc body POST treo với `@hono/node-server/vercel` (Readable.toWeb deadlock). Đã fix bằng buffer rawBody trong `web/backend/api/index.ts` — **KHÔNG gỡ**. Mọi POST mới (web/extension/webhook) phụ thuộc fix này khi chạy trên Vercel.
- **URL production:** frontend=`https://studymovie-frontend.vercel.app`, backend=`https://studymovie-backend.vercel.app`. (manifest extension đã trỏ host frontend này; build:prod đọc extension/.env.production.)
- **Blocker / cần làm:** Khách chốt UI streak "hôm nay chưa đạt" (backend đã có cờ `today_met`).

---

## Session log

### Session 16 — TIP-014 Timer THỦ CÔNG Start/Stop + streak >10 phút (2026-06-29)
- **TIP/Feature:** TIP-014 — EXT-03 đổi timer tự động → thủ công (theo Figma + comment khách Truong Luc). Self-tested; chờ Homeowner test Chrome.
- **Đã làm:**
  - **GỠ auto-timer:** xóa `extension/src/content/timer.ts` (đo wall-clock bám <video>), bỏ khỏi `build.mjs` entry + `manifest.json` content_scripts → hết double-track (AC-7). Giữ youtube.ts/yt-intercept.ts (phụ đề/click-từ — KHÔNG đụng).
  - **Background timer** (`service-worker.ts`): state ở chrome.storage `sm-timer-state` (running/sessionStartedAt/flushedSec) — bền khi popup đóng. Messages SM_TIMER_START/STOP/STATE. Flush định kỳ qua `chrome.alarms` 0.5'(~30s) khi running → POST `/api/study-session` phần chưa flush (cộng HẾT; lỗi mạng giữ flushedSec gửi lại). `onStartup` finalize nếu còn running (KHÔNG đếm thời gian Chrome đóng). Thêm permission `alarms`.
  - **Popup** (`popup.ts`+`.html`): card "Thời gian học" HH:MM:SS đếm lên realtime (tick 1s, seed từ background), nút Bắt đầu/Kết thúc enable/disable; Kết thúc xong refresh "phút hôm nay". State lấy từ background (AC-3).
  - **Backend** `study-session.ts`: cap MAX_SEC 3600→86400 (an toàn 1 ngày, không loại trừ).
  - **RPC streak** (migration `20260629000005_streak_threshold.sql`): `get_dashboard` streak dùng ngưỡng cố định **>600s/ngày** (UTC+7) thay goal cam kết; `today_met`/tổng giờ/biểu đồ tuần-tháng GIỮ NGUYÊN.
- **Verification (tự test):** init.sh exit 0 (lint+typecheck 3 pkg); ext build dev OK (dist không còn timer.js); backend 20/20 test.
- **CHỜ HOMEOWNER (Chrome):** reload ext → Bắt đầu/đợi/Kết thúc (AC-1), HH:MM:SS đếm lên (AC-2), đóng/mở popup state còn (AC-3), Start/Stop nhiều lần cộng hết (AC-4), tắt Chrome (AC-5). AC-6 streak: áp migration 005 + dữ liệu nhiều ngày / kiểm DB.
- **Commit:** feat(ext): TIP-014 manual start/stop timer + streak >10min threshold.

### Session 15 — TIP-013 VERIFIED production + fix Vercel body deadlock (2026-06-29)
- **TIP/Feature:** TIP-013 — BE-04 + BE-05 → **verified** (production thật).
- **Sự cố production:** webhook SePay timeout (SePay buông 30s, Vercel kill 300s). Debug Protocol nhiều vòng:
  - Log `[wh]`: `apikey OK, before read body` nhưng KHÔNG có `after read body` → treo tại đọc body. Loại nghi key (verify OK) + Supabase (create-order insert service_role chạy OK; webhook chưa tới query).
  - Giải mâu thuẫn "create-order chạy được": create-order KHÔNG đọc body → không chứng minh body-read OK.
  - Gốc: adapter `@hono/node-server/vercel` deadlock ở `Readable.toWeb(incoming)` với body request SePay (Node stream kẹt backpressure). `c.req.text()/json()/arrayBuffer()` đều treo (cùng đường adapter).
- **FIX (chỉ `web/backend/api/index.ts`):** wrapper tự buffer raw body tầng Node (`for await (chunk of req)` chủ động kéo) → gán `req.rawBody` → adapter dùng fast-path (enqueue Buffer 1 lần), né toWeb. GET/HEAD bỏ qua. Sửa cả webhook lẫn MỌI POST trên Vercel. `src/index.ts` dev nguyên.
- **Verify production:** SePay "Phát lại" tx 65630775 → `[wh] after read body` xuất hiện → verify key → đối soát mã `SMT1GIE6OH` + 49000 → Pro active, hạn 29/7/2026. **AC-4:** phát lại 3 lần đều 200, KHÔNG cộng đôi (idempotency PASS). AC-1/AC-3/AC-4 pass thật.
- **Dọn:** gỡ toàn bộ log debug `[wh]/[pl]/[co]`; GIỮ buffer rawBody (fix thật). Lint/typecheck/20 test pass.
- **Commit:** fix(payment): buffer rawBody for Vercel serverless webhook; BE-04/05 verified.

### Session 14 — TIP-013 Thanh toán Pro (VietQR + SePay webhook + kích hoạt) (2026-06-29)
- **TIP/Feature:** TIP-013 — BE-05 (VietQR + /upgrade) + BE-04 (webhook). Lưu ý: feature_list KHÔNG có id WEB-08 (trang /upgrade nằm trong title BE-05) → đánh BE-04+BE-05 done, ghi chú trong report (không tự thêm id ngoài scope).
- **Đã làm:**
  - **Migration** `supabase/migrations/20260629000004_payment_orders.sql`: bảng `payment_orders(id, code UNIQUE, user_id, amount, status pending|paid|expired, sepay_tx_id UNIQUE, created_at, paid_at)`. RLS: user SELECT đơn của mình; ghi qua service_role (không policy insert/update).
  - **Backend `api/payment.ts`** (service_role): create-order (sinh code SM+8base36 duy nhất, retry chống trùng), get order (poll, lọc user_id), **webhook** cửa bảo mật. Pure helpers test được: generateOrderCode/parseOrderCode/computeNextPaidUntil/buildVietQrUrl/verifyApiKey. Route webhook để NGOÀI requireAuth, create-order/order trong requireAuth.
  - **Webhook bảo mật:** verify Apikey constant-time (key trống→reject all); chỉ transferType=in; idempotency payload.id (sepay_tx_id UNIQUE + pre-check); đối soát code (content/field code) + đơn pending + tiền ≥ amount; update guard status='pending' (1 lần) → subscriptions paid_until=max(now,cũ)+PRO_DURATION_DAYS, status=active. Mọi nhánh sai → 200 KHÔNG kích hoạt.
  - **env.ts:** SEPAY_API_KEY, BANK_ID, BANK_ACCOUNT_NO, BANK_ACCOUNT_NAME, VIETQR_TEMPLATE(=compact2), PRO_PRICE(=49000), PRO_DURATION_DAYS(=30). `.env.example` cập nhật (không giá trị thật).
  - **Frontend** `lib/payment.ts` + `app/upgrade/page.tsx` thật: nút Mua Pro → QR VietQR ảnh + thông tin CK + nút Chép nội dung + poll 4s → paid → màn thành công + link dashboard; nút "tôi đã CK" kiểm lại.
- **SePay field (theo docs.sepay.vn):** id (tx, idempotency), transferType (in/out), transferAmount (số tiền), content (nội dung CK → bóc code), code (mã SePay auto-extract, dùng dự phòng). Webhook trả 200 `{success:true}` trong 30s.
- **Verification (tự test):** init.sh exit 0 (lint+typecheck 3 pkg); **vitest backend 20/20** (verifyApiKey, parseOrderCode, computeNextPaidUntil cộng dồn, buildVietQrUrl, AC-2 webhook 401 sai/thiếu apikey, tiền-ra/thiếu-id→200); FE build /upgrade OK; backend dev boot — health 200, /api/me 401, webhook no-apikey 401, create-order no-auth 401.
- **CHỜ HOMEOWNER (AC-1/3/4/6 end-to-end):** áp migration prod; nhập env Vercel backend; cấu hình webhook SePay URL; test SePay sandbox (mô phỏng giao dịch, không cần tiền thật). Checklist trong Completion Report.
- **Bảo mật:** không commit secret (scan sạch); webhook verify Apikey; service_role chỉ backend. SEPAY_API_KEY + số TK do Homeowner nhập Vercel.
- **Commit:** feat(payment): TIP-013 VietQR order + SePay webhook + Pro activation (local — CHỜ duyệt push).

### Session 13 — TIP-012 Deploy VERIFIED production (2026-06-29)
- **TIP/Feature:** TIP-012 — INF-03 → **verified**. Homeowner deploy live 2 project Vercel + test production.
- **URL:** frontend `https://studymovie-frontend.vercel.app`, backend `https://studymovie-backend.vercel.app`.
- **Homeowner test OK:** login Google, dashboard, vocab, playlist, CORS, backend `/health` 200.
- **Đã làm (Thợ):** `manifest.json` đổi placeholder `studymovie.vercel.app` → `studymovie-frontend.vercel.app` (host_permissions + content_scripts.matches), giữ `localhost:3000`. feature_list INF-03 → verified (+ URL trong evidence). progress cập nhật URL + trạng thái.
- **Commit:** chore(deploy): TIP-012 production URLs + manifest prod domain.
- **Lưu ý bảo mật:** service_role key vẫn ở `.env` local (gitignore) + Vercel env backend; nhắc Homeowner rotate nếu lo lộ (không bắt buộc).

### Session 12 — TIP-012 Deploy config Vercel (frontend + backend serverless) (2026-06-28)
- **TIP/Feature:** TIP-012 — INF-03 (deploy config). Thợ chuẩn bị code/config; live deploy = Homeowner (Thợ không có quyền tài khoản).
- **Đã làm:**
  - **Backend serverless:** `web/backend/api/index.ts` (`@hono/node-server/vercel` `handle`, Node runtime) + `web/backend/vercel.json` (rewrite `/(.*)`→`/api` để Hono tự định tuyến /health, /api/*). tsconfig include thêm `api`. `env.ts` đã đọc `process.env` (Vercel env) — local fallback root .env.
  - **CORS** (`app.ts`): giữ `localhost:3000` (dev) + `SITE_URL` (env = prod frontend) + `chrome-extension://`. KHÔNG '*'.
  - **Frontend:** không đổi code — NEXT_PUBLIC_* set qua Vercel env, next.config inline. Root-.env loader fail-silent trên Vercel.
  - **Extension prod:** `build.mjs --prod` đọc `extension/.env.production` (template `.env.production.example`, gitignore `.env.production`); script `build:prod`; manifest thêm host `https://studymovie.vercel.app/*` (placeholder Homeowner đổi) + giữ localhost.
  - `.env.example`: ghi rõ var nào ở Vercel project frontend vs backend.
- **Kiến trúc chốt:** 2 Vercel project riêng (frontend Root=web/frontend, backend Root=web/backend) → CORS/độc lập rõ ràng.
- **Verification (tự test):** init.sh exit 0 (lint+typecheck 3 pkg, api/ typecheck OK); ext build dev + build:prod chạy; backend dev boot (health 200, /api/me 401) — **AC-7 dev flow KHÔNG hỏng**; secret scan sạch; `.env.production` được ignore.
- **CHỜ HOMEOWNER (AC-1..5 live):** tạo 2 project Vercel, nhập env vars, Supabase redirect URL production, deploy. Checklist trong Completion Report.
- **Deviation:** Thêm entry INF-03 (deploy config, tip TIP-012) thay vì đánh INF-02 (TIP-014 handover đầy đủ — gồm đóng gói extension/HANDOVER/transfer, chưa làm).
- **Commit:** chore(deploy): TIP-012 Vercel deploy config.

### Session 11 — TIP-011 Playlist (paste link + thumbnail/title + học/done/xóa) (2026-06-28)
- **TIP/Feature:** TIP-011 — WEB-06 trang /playlist.
- **Đã làm:**
  - **Backend `api/playlist.ts`** (getUserClient/RLS): GET list; POST (parse videoId watch?v=/youtu.be/shorts/embed, validate 11-ký-tự → 400 nếu sai; **oEmbed** `youtube.com/oembed` server-side timeout 5s lấy title, lỗi → fallback=videoId; thumbnail `img.youtube.com/vi/{id}/hqdefault.jpg`); PATCH is_done toggle; DELETE (own). Wire app.ts.
  - **`lib/playlist.ts`** + **`app/playlist/page.tsx`**: dán link+Thêm, list thumbnail+title+trạng thái, nút **Học** (mở tab YouTube — timer TIP-010 tự tính giờ), tick **Xong** (toggle), **Xóa** (confirm), empty state. Bật nav Playlist.
- **Verification:** init.sh exit 0; FE build (/playlist); **`verify_playlist.mjs` 12/12 PASS** (link sai→400, oEmbed title thật 'Rick Astley…', youtu.be parse, GET/PATCH/DELETE, 401, not-own delete=false).
- **Còn dở (Homeowner browser):** UI thêm/list/Học/done/xóa + thumbnail/title hiển thị.
- **Deviation:** Nút Học CHỈ mở video (timer tự động TIP-010 lo tính giờ — không cần tín hiệu start riêng, đúng chốt). Sửa feature_list WEB-06 tip TIP-006→TIP-011.
- **Cách resume:** /playlist → dán link → Học/done/xóa.
- **Commit:** feat(web): TIP-011 playlist.
- **Fix UX (cùng TIP-011, sau test):** thông báo lỗi thân thiện thay raw "API /path → HTTP n". Backend trả mã `invalid_youtube_url`; `apiClient` thêm `ApiError(status, code)` (đọc body.error); page map → "Link không hợp lệ. Vui lòng dán link YouTube…". Homeowner test OK. → WEB-06 verified.

### Session 10 — TIP-010 Auto study timer → study_sessions (2026-06-28)
- **TIP/Feature:** TIP-010 — EXT-03 timer tự động ghi study_sessions (sinh dữ liệu giờ cho dashboard/leaderboard/streak).
- **Đã làm:**
  - **`content/timer.ts`** (ISOLATED, youtube.com): đo **wall-clock** khi video đang phát (play/playing→tính; pause/ended/emptied→dừng). Tua dùng wall-clock nên KHÔNG cộng bước nhảy. Flush **delta** (giây) qua background SM_API: định kỳ **60s** + sự kiện (pause/ended/đổi video/visibility hidden/pagehide). Chống double-count (trừ phần đã gửi, giữ phần lẻ <1s). Cap 3600s/flush.
  - **Backend `POST /api/study-session`**: getUserClient insert study_sessions (`started_at=now−duration`, `ended_at=now` → RPC nhóm theo started_at UTC+7), validate `>0 & ≤3600`. Wire app.ts.
  - **Popup**: thêm "Hôm nay X phút" (today_minutes từ /api/dashboard).
  - Manifest + build: thêm content script `timer.js`.
- **Verification:**
  - init.sh exit 0 (lint+typecheck 3 pkg); extension build (timer.js 1.9kb).
  - **`verify_timer.mjs` 10/10 PASS**: 401; POST 120s+90s → 2 row tổng 210s, started_at≤ended_at; today_minutes=3; validate 0/-5/99999/"abc"→400; cleanup.
- **Còn dở (Homeowner test Chrome):** AC-1 đo giờ khi phát/pause, AC-2 không cộng tua, AC-5 dashboard/leaderboard "sống" theo giờ thật, AC-6 popup phút.
- **Deviation:** (1) Timer TỰ ĐỘNG theo trạng thái video (không nút Start/Pause/Stop — đúng chốt). (2) Set started_at/ended_at (TIP ghi created_at, nhưng RPC nhóm theo started_at NOT NULL → set đúng để dashboard tính). (3) "Nút Học từ playlist auto-start" (trong title EXT-03) thuộc WEB-06 (chưa làm) → ngoài scope TIP-010, để sau.
- **Cách resume:** xem video YouTube vài phút → /dashboard + /leaderboard có giờ thật.
- **Commit:** feat(ext): TIP-010 auto study timer -> study_sessions.

### Session 9 — TIP-009 Lemmatize v2 + Free Dictionary fallback + cache + audio (2026-06-28)
- **TIP/Feature:** TIP-009 — cải thiện tra từ (EXT-02/BE-06). Fix lemmatize + fallback Free Dictionary API + cache + credit.
- **Đã làm:**
  - **Migration `20260628000003_lookup_word_v2.sql`** (push cloud OK): `ALTER dictionary ADD source default 'fvdp'`; `lookup_word` v2 thêm rule **'s** (dog's→dog) + **-er/-est/-ier** (bigger→big, happier→happy, larger→large) + phụ âm đôi; exact-first (giữ it's/don't). Trả thêm `source`.
  - **Backend `/api/lookup`** (`api/lookup.ts`): FVDP miss → fetch `api.dictionaryapi.dev` server-side (timeout 5s, xử 404/429/network) → định nghĩa EN + IPA + audio → **cache** upsert dictionary `source='free_dict'` (lần sau RPC tìm thấy, khỏi gọi API). Trả `source`/`status`.
  - **Extension popup** (`youtube.ts`): nhãn "📖 định nghĩa tiếng Anh" khi `source=free_dict`; status `not_found`/`error` → message hợp lý.
  - **Settings**: thêm credit **Free Dictionary API (Wiktionary, CC BY-SA)** + link, cạnh credit FVDP GPL.
- **Verification:**
  - Re-verify lemmatize: từ cũ (run/walked/cities/it's/don't/children/went) KHÔNG hồi quy; từ mới (dog's/world's/bigger/biggest/happier/larger/taller/happiest) giờ HIT.
  - `init.sh` exit 0 (lint+typecheck 3 pkg); extension build + FE build OK.
  - **`verify_lookup.mjs` 8/8 PASS**: 401; bigger→big(fvdp); dog's→dog; neuron→free_dict (3 nghĩa EN + IPA `/ˈnjəɹɑn/`); cache row source=free_dict; lần 2 OK; từ bịa→not_found không crash. (cleanup cache test + user tạm.)
- **Còn dở / chưa verify (Homeowner browser):** UI popup hiển thị nhãn EN + audio khi click từ chuyên ngành thật; lemmatize trên video thật.
- **Deviation/Defer:** (1) Sửa RPC lookup_word (đã verified TIP-002) → đã re-verify không hồi quy, evidence ghi vào BE-02/EXT-02. (2) **HOÃN** audio-cho-từ-FVDP-thiếu-audio (gọi API cho mọi từ FVDP thiếu audio = rất nhiều call, rủi ro rate-limit) — chỉ lấy audio qua fallback free_dict. (3) cleanWord client KHÔNG đổi (RPC xử 's exact-first đủ, giữ contraction).
- **Cách resume:** `npm run dev` + extension reload → click từ chuyên ngành (neuron) → định nghĩa EN + audio; click dog's/bigger → ra nghĩa.
- **Commit:** feat(lookup): TIP-009 lemmatize rules + Free Dictionary fallback + cache + audio.
- **Fix phụ đề (cùng TIP-009, sau test Chrome — 4 vòng debug):**
  1. Mất VI: VI 1103B = trang Google "Sorry/automated queries" → **anti-bot chặn request VI thứ 2 (burst)**. Fix: intercept **body EN player đã tải** (bớt 1 request) + VI fetch sau **delay 500ms** + **retry 1 lần** khi gặp Sorry + detect "Sorry" + phân biệt 3 trạng thái VI (ok/blocked/empty) + nhãn.
  2. Lag biến thiên 1–3s: KHÔNG phải nguồn cue (body≡refetch) mà **logic chọn cue sai** — first-match + cue GỐI nhau → cue cũ che cue mới. Fix: **max-start match** (bỏ break, chọn cue start lớn nhất thỏa start≤t<start+dur); khoảng trống → ẩn. Bug có sẵn từ TIP-005, lộ ở video cue gối.
  - Homeowner test OK: cue gối + thường + tua + song ngữ. Commit: `fix(ext): phụ đề VI anti-bot + max-start cue matching`.

### Session 8 — TIP-008 Điều tra nguồn từ điển Wiktionary (KHÔNG swap) (2026-06-28)
- **TIP/Feature:** TIP-008 — điều tra đổi nguồn dictionary FVDP → Wiktionary (CC BY-SA). 2 giai đoạn, chốt chặn trước khi swap.
- **Đã làm (Giai đoạn 1 — chỉ điều tra, KHÔNG swap):** stream-count mẫu 9.52% (300MB giữa file) của kaikki.org Wiktextract English (3.15GB), trích cặp EN→VI từ `translations[code=vi]`.
- **Kết quả:** chỉ ~0.043% entry có nghĩa VI → ngoại suy **≈ 620 từ EN-VI toàn file** (mẫu 59/138.008). Chất lượng lệch về danh từ riêng + lẫn nhiễu (vd `appealable→cặc` sai bậy).
- **Quyết định (Chủ thầu duyệt):** Wiktionary EN→VI (~620) **kém xa FVDP (103.401)** cả lượng lẫn chất → **GIỮ FVDP, KHÔNG swap.** Không đổi data, không đổi credit (vẫn FVDP GPL v2).
- **Thay đổi repo:** KHÔNG (chỉ chạy đếm trong scratchpad, đã dọn). Bảng dictionary nguyên 103.401 mục FVDP. Schema/RPC/credit giữ nguyên.
- **Lưu ý môi trường:** kaikki tải ~0.3–0.6 MB/s nên dùng mẫu + ngoại suy theo tỉ lệ byte (không tải full 3.15GB).

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
