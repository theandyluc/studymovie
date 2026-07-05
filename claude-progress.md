# claude-progress.md — StudyMovie

> Nhật ký từng session. Mỗi session đọc file này TRƯỚC khi làm, và ghi 1 entry mới ở CUỐI.
> Mục tiêu: session sau pick up đúng chỗ session trước dừng. Mới nhất ở trên cùng.

---

## Trạng thái tổng quan

- **⚠️ D-2 ĐẢO CÓ KIỂM SOÁT (2026-07-02, khách duyệt, TIP-038):** NGHĨA từ giờ dùng **AI GPT-4o-mini (OpenAI)** theo ngữ cảnh câu — backend `/api/lookup-context` (protected, OPENAI_API_KEY server-side, cache bảng `ai_context_meaning` = migration 012, **fallback về từ điển** khi lỗi/thiếu key). IPA/audio vẫn từ từ điển. Từ điển FVDP = fallback. **Vận hành cần:** áp migration 012 + đặt OPENAI_API_KEY ở backend Vercel + redeploy.
- **Giai đoạn hiện tại:** TIP-021→028 + **QA-01 VERIFIED** + **INF-04 VERIFIED** (domain app.studymovie.com) + **INF-02 DONE** (TIP-031 bàn giao) + **WEB-DARK VERIFIED** (TIP-034/035) + **Feedback khách 2/7: #3/#4/#5 done, #1 done** (TIP-038/038b nghĩa ngữ cảnh AI; còn #2/#6/#7). **KỸ THUẬT XONG.** Còn lại = **Homeowner action** để INF-02 → verified: push→auto-deploy→check /privacy + icon extension; submit Chrome Web Store (zip dist); **transfer ownership** GitHub+Supabase(giữ Singapore)+Vercel + **xoay TOÀN BỘ key** theo `HANDOVER.md`. Việc treo: `/blog` (khách cấp URL → đặt NEXT_PUBLIC_BLOG_URL + redeploy).
- **VAI TRÒ:** Phiên chính đóng vai **CHỦ THẦU** (viết TIP, review report, gate verified); Thợ là phiên Claude Code khác thực thi. Giao TIP tuần tự.
- **MIGRATION ĐÃ ÁP production:** 008 (get_access_status) + 009 (admin) + 010 (vocab learned_at). Bootstrap `is_admin=true` cho dokhiem562@gmail.com xong.
- **SCOPE RESKIN ĐÃ CHỐT (từ Figma, Homeowner duyệt):** TOÀN BỘ web + extension. Gồm 3 thay đổi đảo feature verified: flashcard NÚT→**swipe**, học TẤT CẢ→**chọn từ (tick)**, extension Google-only→**+email/mật khẩu**.
- **TASK GRAPH reskin:** ✅TIP-021 reskin web → ✅TIP-022 reskin extension → ✅TIP-023 phụ đề ext → ✅TIP-024 vocab status + form thêm từ web → ✅TIP-025 vocab search/lọc/phân trang/biểu đồ → ✅TIP-026 flashcard swipe + chọn-từ + mark-learned → ✅TIP-027 extension email/mật khẩu+đăng ký → ✅TIP-028 polish (countdown thanh toán + nút Tắt extension + leaderboard top5) → ✅QA-01 (sweep + smoke) → **INF-02 (kế tiếp — bàn giao)**.
- **FIGMA:** ảnh export ở `C:\Users\ADMIN\OneDrive\Máy tính\Figma\` (Webapp 20 + Extension 8 + Phụ đề 7). Token hex suy từ ảnh (chưa có Dev Mode chính thức) — rà lại nếu khách đưa hex.
- **LƯU Ý KỸ THUẬT (quan trọng):** Vercel serverless đọc body POST treo với `@hono/node-server/vercel` (Readable.toWeb deadlock). Đã fix bằng buffer rawBody trong `web/backend/api/index.ts` — **KHÔNG gỡ**. Mọi POST mới (web/extension/webhook) phụ thuộc fix này khi chạy trên Vercel.
- **URL production (INF-04):** web app=`https://app.studymovie.com` (Vercel project studymovie-frontend; apex `studymovie.com` = landing của KHÁCH, đã gỡ khỏi project), backend=`https://studymovie-backend.vercel.app` (GIỮ nguyên). Extension manifest + build:prod trỏ `app.studymovie.com`. env `NEXT_PUBLIC_SITE_URL=https://app.studymovie.com` ở CẢ 2 Vercel project (backend=CORS). Supabase Site URL + redirect + Google OAuth origin đã thêm app.studymovie.com.
- **Blocker / cần làm:** Khách chốt UI streak "hôm nay chưa đạt" (backend đã có cờ `today_met`).

---

## Session log

### Session 38 — TIP-085→094: pixel-perfect polish popup extension + phụ đề YouTube + fix thanh toán/leaderboard (2026-07-05/06)
- **Bối cảnh:** tiếp nối phong cách Session 37 nhưng chuyển sang **extension** — khách chỉnh tay từng px/màu/font/spacing qua rất nhiều lượt phản hồi trực tiếp cho popup (KHÔNG dùng Playwright đo như web, vì extension popup không mở được qua localhost — đã giải thích rõ giới hạn này cho khách: popup phụ thuộc `chrome.*` API, chỉ chạy được khi load unpacked thật trong Chrome).
- **Đã làm (rất nhiều lượt, tóm tắt theo khối):**
  - **Trước đó trong session (web, đã push riêng — xem thêm ở feature_list `payment.price`/`leaderboard`):** thêm `GET /api/payment/price` (giá Pro động đồng bộ /admin), gói Pro 1 năm (`PRO_DURATION_DAYS` 30→365), UI trang `/thanh-toan` + `/cam-on` theo thông số Figma mới, migration `20260705000015_leaderboard_next_rank.sql` (user chưa ranked + top<5 → gán hạng kế tiếp thay vì ẩn số hạng) — **đã push + apply lên Supabase production**.
  - **Extension popup — màn đăng nhập/đăng ký:** tab 144x24 bo góc riêng, icon SVG thay emoji (kể cả cờ 🇬🇧 — tránh lỗi không hiện trên Windows), input/nút submit đúng size theo Figma (scale ×1.15 rồi ×1.05 theo yêu cầu khách), toggle link tách khỏi text tĩnh, letter-spacing -3% toàn bộ, màu đen chuẩn hoá `#1f1f1f`.
  - **Extension popup — màn chính (đã đăng nhập):** card Thời gian học 194x135 + card Chế độ phụ đề 242x204 cố định (trước đó co giãn theo trạng thái → lệch hàng với card stat), icon SVG cho nút play/pause/stop + footer (đăng xuất/hỗ trợ/tắt StudyMovie), hover/active đồng bộ opacity 50%→100% (cả icon lẫn viền), chấm đổi màu nền luôn hiện (bỏ phụ thuộc toggle), stepper +/- bỏ số hiển thị giữa.
  - **Extension popup — màn loading mới:** logo "film-open-star" (đồng bộ web app, thay text "SM." cũ) + text "StudyMovie" căn giữa, vòng tròn xoay quanh (CSS animation, không cần JS).
  - **Phụ đề YouTube (`youtube.ts`):** thêm `font-family: Inter` + `letter-spacing: -3%`, giữ nguyên bold(EN)/normal(VI).
  - **`settings.ts`:** đổi default `fontSizePx` 20→24, `bgOpacity` 20→80, `lineGapPx` 2→0 (`GAP_MIN` 2→0). **FIX BUG THẬT:** `normalize()` dùng `Number(x) || default` khiến `lineGapPx=0` (giá trị hợp lệ) bị ghi đè ngược về default (vì `0` falsy trong JS) — đổi sang `??`.
  - **Tooling:** thêm `npm run dev` (esbuild `--watch`) trong `extension/` để rebuild tự động khi sửa code, đỡ phải gõ lại `build:prod` mỗi lần.
- **Verification:** `npm run lint`/`typecheck`/`build`/`build:prod` (extension) — PASS sau mỗi vòng chỉnh sửa (chạy rất nhiều lần trong session). Web: lint/typecheck/build (frontend) + lint/typecheck/test (backend) PASS trước khi push phần payment/leaderboard.
- **Còn dở / chưa verify:**
  - Code đã push lên `main` (commit `66012bb`, `8312c92`, `6b343ad`) nhưng **CHƯA build:prod + nộp Chrome Web Store** — cần Homeowner tự làm (cần tài khoản developer Chrome Web Store thật, ngoài quyền Thợ).
  - Khách từng bị crash "supabaseUrl is required" do lỡ load nhầm bản `npm run build` (dev, thiếu root `.env`) thay vì `build:prod` — đã giải thích, không phải bug.
  - Khách gặp `chrome.storage` không tự cập nhật default mới khi đã có giá trị cũ lưu sẵn (không phải bug — do cách chrome.storage hoạt động, chỉ default cho lần cài đầu) — đã hướng dẫn cách xoá storage qua DevTools service worker.
- **Cách resume:** đọc lại phần "Extension popup" ở trên để biết style/spacing hiện tại (nhiều số liệu px cụ thể, xem trực tiếp `popup.html`/`popup.ts` nếu cần chính xác). Nếu khách muốn tiếp tục chỉnh UI, làm tương tự — không có cách preview qua localhost, phải load unpacked thật.
- **Commit:** style(extension): pixel-perfect polish popup theo Figma (đăng nhập, home, loading) [66012bb]; style(extension): chỉnh phụ đề YouTube + fix bug lineGapPx=0 [8312c92]; style(extension): dòng cuối màn đăng nhập/đăng ký cách đáy layout 20px [6b343ad]; feat(payment,leaderboard): giá Pro động + fix hạng ẩn khi top chưa đủ 5 [7a5f41a]; fix(web): card Level cố định 374x174 [dc58acb].

### Session 37 — TIP-081: pixel-perfect polish 5 trang web theo Figma + fix bug mock CRUD (2026-07-05)
- **Bối cảnh:** tiếp nối reskin TIP-033 — khách chỉnh tay từng chi tiết nhỏ (px/màu/font/vị trí) qua rất nhiều lượt phản hồi trực tiếp, đo bằng Playwright thay vì đoán, cho 5 trang: Dashboard, Từ vựng, Học từ vựng (flashcard), Kiểm tra Anh-Việt/Việt-Anh (`QuizGame.tsx` dùng chung).
- **Việc đã làm (tóm tắt, chi tiết ở evidence `feature_list.json` id `WEB-TIP081`):**
  - Dashboard: CircleStat "Tổng thời gian đã học" (đồng bộ số liệu với tooltip Level card, format thập phân VN 1 số sau phẩy, tooltip width tự co `w-max`); WeeklyPlan luôn 7 dòng sửa tại chỗ; LeaderboardCard tag "(bạn)" tách khỏi span truncate (bug: tên dài đẩy tag bị cắt mất theo "…").
  - Từ vựng: bảng dùng `colgroup` khớp header overlay, 2 filter (ngày/trạng thái) dạng popup overlay đúng pixel dòng đầu, phân trang neo giữa card cố định bất kể độ dài nút cạnh bên, PAGE_SIZE 10→6, card tự co theo số dòng thật (bỏ `min-h` cứng).
  - Học từ vựng: flashcard 300×412 đúng toạ độ Figma (chữ/icon loa/phiên âm), card-stack 3 lớp hiện ĐÚNG nội dung thẻ kế tiếp thật (trước là placeholder trống), sửa hiệu ứng swipe bị "bay vào" sai khi đổi thẻ (do transition không được tắt đúng 1 frame), viết lại tutorial overlay từ đầu theo mô tả animation cursor+circle 3 pha lặp vô hạn.
  - Kiểm tra Anh-Việt/Việt-Anh: adapt style card+burger từ Học từ vựng, thêm phiên âm + auto-play audio (chiều Anh→Việt) + sound đúng/sai, sửa border trạng thái "đang chọn" (bug: dùng nhầm token `info-foreground` — vốn để tô CHỮ, không phải viền — ra màu gần đen; đổi `#005FB9`).
  - **Bug fix mock (`lib/devMocks.ts`):** `mark-learned` trước chỉ trả `{updated:1}` giả mà KHÔNG set `learned_at` thật → từ học xong không chuyển "Đã học". Đã sửa đọc `ids` từ body và cập nhật đúng mảng. Thêm bảng tra IPA tạm (32 từ) cho từ thêm mới qua UI.
  - Popup `ConfirmDialog` (`components/ui/feedback.tsx`): title `font-medium`, nút xoá `bg-red-700` (bớt chói), `rounded-[10px]`.
- **Verification:** `npm run lint` + `npm run typecheck` + `npm run build` ở `web/frontend` — cả 3 PASS (lint có 1 lỗi eslint-disable-comment thừa tham chiếu rule không tồn tại trong config project này — đã xoá). Không đổi backend/schema/RPC.
- **Resume:** UI web coi như xong đợt này theo khách. Tiếp theo dự kiến chuyển qua sửa UI **extension** — session sau nên đọc lại `CLAUDE.md` mục 7 (Session Lifecycle) + phần extension trong Blueprint trước khi bắt đầu TIP mới. Chưa push lên `main` (chờ khách xác nhận).

### Session 36 — TIP-033: redesign web app khớp Figma (5 màn, calibrate) (2026-07-01)
- **Yêu cầu khách:** redesign UI web app "giống hệt file Figma". Nguồn = 20 ảnh PNG (Figma\Webapp), KHÔNG có Dev Mode → so bằng mắt (~95%). Cách làm: calibrate từng màn, Homeowner duyệt từng cái. Khách chê "tổng thể + layout/khoảng cách". Tokens (globals.css @theme) đã gần Figma → chủ yếu sửa LAYOUT từng trang.
- **5 màn đã calibrate + Homeowner DUYỆT (2026-07-01):**
  1. **Dashboard** (`/dashboard`): lưới 2×2 — card 3 vòng CircleStat (Thời gian/Từ vựng/Streak) + card Level (2 vòng, cung tím) | Kế hoạch tuần (thêm quote) + **LeaderboardCard** (mới, top5+ghim, giữ trang /leaderboard riêng). Bỏ bar chart. Tiêu đề "Tiến độ học". Component mới: `CircleStat`, `LeaderboardCard`.
  2. **Từ vựng** (`/tu-vung`): bỏ h1+nút top; toolbar (tiêu đề+search+"+Thêm từ vựng" toggle form); STT pill; filter icon (▽) popover ở header cột Ngày/Trạng thái; chart có trục y+lưới+tooltip hộp; ring tổng mảnh (border-4); footer đếm+phân trang+"Học các từ đã chọn" (bỏ nút Quiz — vào từ menu flashcard).
  3. **Flashcard** (`/hoc-tu-vung`): thẻ dọc (portrait, chữ trên-trái+loa, chấm đen góc dưới); bỏ thanh top; tutorial = overlay tối+thẻ mờ+con trỏ+chữ trắng; menu ≡ nền tối.
  4. **Quiz** (`QuizGame`, 2 route): thẻ hỏi dọc+loa(en2vi); 4 đáp án 4 STATE màu Figma (trắng→**xanh dương #a9d1fb đang chọn**→xanh lá đúng→hồng sai, 2 pha 450ms/1600ms tự sang câu); menu ≡ nền tối; bỏ thanh top.
  5. **Thanh toán** (`/thanh-toan`): tiêu đề "Quét mã QR bên dưới"+countdown lớn+ảnh VietQR compact2 (đã gồm logo+info CK, bỏ dl trùng). **THEO CHÚ THÍCH FIGMA: countdown về 0 KHÔNG hết hạn** (bỏ "Tạo mã mới" — NGƯỢC TIP-028; Homeowner đã chọn theo Figma).
- **Migration 011** (`20260701000011_dashboard_totals.sql`): get_dashboard + `total_minutes` + `vocab_learned` (additive). **CHƯA áp cloud** → 2 số dashboard = 0 tới khi áp. Frontend fallback `?? 0`.
- **KHÔNG có trong Figma** (giữ nguyên): Login, Cảm ơn, Hỗ trợ, Admin, Playlist.
- **Verify:** mỗi màn lint+typecheck+build sạch. Homeowner duyệt visual từng màn qua localhost. Đã push (8 commit) + cần áp migration 011.

### Session 35 — TIP-031 (INF-02): đóng gói bàn giao + Chrome Web Store (2026-07-01)
- **6/6 WI xong, commit riêng từng cái (local, CHƯA push, ahead 6):** WI-1 `.env.example` SITE_URL→app.studymovie.com + audit env (đủ biến runtime; PORT/DICT_LIMIT optional; GOOGLE_OAUTH_* là tài liệu). WI-2 trang `/privacy` (web/frontend/app/privacy/page.tsx) public render tĩnh, ngoài PROTECTED của AccessGuard → reviewer xem được. WI-3 icon từ logo.png: sinh 16/48/128 bằng sharp (trim viền + pad ~9% + nền trắng) → extension/icons/, manifest + action.default_icon, build.mjs copy dist/icons (dev+prod, không copy logo nguồn); giữ logo.png nguồn để bàn giao. WI-4 manifest bản store: version 0.0.1→1.0.0 + build.mjs khi `--prod` lọc entry `localhost` (dev giữ). WI-5 `HANDOVER.md` (kiến trúc + bảng env không secret + deploy + migrations + transfer ownership + xoay key + dev setup + verify). WI-6 mục Chrome Web Store submission trong HANDOVER (mô tả + privacy URL app.studymovie.com/privacy + data usage + giải trình 5 permission + email dkhiem2k4@gmail.com).
- **Lưu ý:** TIP-031 lần 1 thiếu WI-3 (đã báo); lần 2 gửi đủ. logo.png nguồn nằm ở `C:\Users\ADMIN\OneDrive\Máy tính\Figma\logo.png` (khách cấp) — đã copy vào extension/icons/. Máy KHÔNG có ImageMagick (`convert` là convert.exe của Windows) nhưng có `sharp` (dep của Next) → dùng sharp.
- **Gate cuối PASS:** FE lint+typecheck+build OK (/privacy = ○ static 162B); ext `npm run build` (dev, localhost + v1.0.0 + icons) + `build:prod` (bỏ localhost, app.studymovie.com×2, youtube, v1.0.0, icons×6, logo.png không lọt dist, service_role KHÔNG lộ) OK; init.sh exit 0. HANDOVER.md tự grep: 0 secret thật, 0 JWT.
- **CHỜ HOMEOWNER:** load unpacked extension/dist xem icon toolbar/popup hiện đúng; mở app.studymovie.com/privacy (prod). Rồi Chủ thầu gate INF-02 → verified + push 6 commit. Việc còn lại = Homeowner transfer ownership + xoay key theo HANDOVER.md.

### Session 34 — INF-04 VERIFIED: đổi domain 2-domain app.studymovie.com (2026-07-01)
- **Quyết định (khách chốt):** `studymovie.com` (apex) = landing page khách tự làm (không login); `app.studymovie.com` (subdomain) = web app nơi user đăng nhập & học. Backend GIỮ `studymovie-backend.vercel.app` (webhook SePay không đổi).
- **Code (fix-forward):** TIP-032 (a0276e3, trỏ apex studymovie.com) → sửa TIP-032b (af69955, trỏ app.studymovie.com) sau khi khách làm rõ 2-domain. manifest host_permissions + auth-bridge matches + extension/.env.production.example → `https://app.studymovie.com` (giữ youtube + localhost). Kèm D-01 (auth-bridge context invalidated) + D-02 (popup /api/me 401 → về màn login thay vì hộp lỗi, phát hiện ở R-3).
- **Homeowner Runbook (đã làm):** NhanHoa DNS thêm CNAME `app`→cname.vercel-dns.com (giữ @/www cho khách); Vercel frontend GỠ studymovie.com+www, ADD app.studymovie.com; env `NEXT_PUBLIC_SITE_URL=https://app.studymovie.com` ở frontend+backend + redeploy; Supabase Site URL + redirect `app.studymovie.com/**`; Google OAuth JS origin. Sự cố dọc đường: gõ nhầm `studymove.com` (thiếu 'i') trong Vercel → sửa; DNS negative-cache máy tính (điện thoại 4G vào được).
- **Verify:** Chủ thầu curl server-side — app.studymovie.com HTTP 200 + SSL hợp lệ; backend CORS trả `Access-Control-Allow-Origin: https://app.studymovie.com` (origin cũ bị cắt). Homeowner runtime extension bản prod: R-2 sync ✓, R-3 logout→login ✓ (D-02), R-4 phụ đề song ngữ ✓, guard lỗi mạng ✓. Web login Google+email ✓.
- **TREO:** (1) `/blog` vòng lặp cũ tự HẾT vì app ở subdomain (BLOG_URL=studymovie.com/blog khác host) — khách sẽ cấp URL blog thật, đặt env + redeploy là xong. (2) `.env.example` (root) dòng SITE_URL còn `studymovie.com` → vá thành `app.studymovie.com` trong TIP-031 (bước audit .env.example).
- **Commit (push kèm session này):** TIP-032, TIP-032b, INF-04 update, D-02. (D-01 đã push trước.)

### Session 33 — DEBUG D-01: auth-bridge "Extension context invalidated" (2026-07-01)
- **Bug:** console tab web văng liên tục "Uncaught Error: Extension context invalidated" tại auth-bridge khi reload extension (chrome://extensions → Reload) mà KHÔNG refresh tab. Fire ~1s/lần.
- **Root cause:** khi context cũ vô hiệu, `chrome.runtime.sendMessage()` NÉM LỖI ĐỒNG BỘ (không phải promise-reject) → `.catch()` async không bắt được → `setInterval(sync,1000)` văng uncaught mãi.
- **Fix (CHỈ extension/src/content/auth-bridge.ts):** thêm `timer` handle + `stop()` (clearInterval + removeEventListener 'storage'); `contextAlive()` qua `chrome.runtime?.id`; đầu `sync()` nếu context chết → stop()+return; bọc sendMessage try/catch ĐỒNG BỘ → catch → stop(). GIỮ `.catch(()=>{})` cho case background ngủ. KHÔNG đổi giao thức (type 'SM_AUTH', extractSession).
- **Verification (AC-3):** ext typecheck sạch + lint No issues + build OK (auth-bridge.js 1.4kb); init.sh exit 0. AC-1 (reload ext không văng uncaught) + AC-2 (login/logout web vẫn đồng bộ sang popup sau khi refresh tab) = Homeowner test trên Chrome.
- **Commit:** fix(ext): D-01 stop auth-bridge poll khi extension context invalidated.

### Session 32 — TIP-028 Polish: countdown thanh toán + Tắt StudyMovie + leaderboard top5 (2026-06-30)
- **TIP/Feature:** TIP-028 — POLISH-01. 3 hạng mục ĐỘC LẬP, KHÔNG migration. TIP tính năng CUỐI trước QA.
- **A — countdown thanh toán** (app/thanh-toan): state secondsLeft=300 (QR_TTL, reset mỗi tạo đơn) + expired; setInterval 1s giảm (dừng khi paid/order null/expired/unmount); 'Mã QR hết hạn sau MM:SS' dưới QR; về 0 → 'Mã QR đã hết hạn' + 'Tạo mã mới' (order=null) + dừng poll; paid→/cam-on giữ nguyên.
- **B — Tắt StudyMovie** (settings.ts + youtube.ts + popup): settings.enabled (default true, normalize r.enabled!==false, key sm-ext-settings giữ). youtube.ts: ensureHideNativeStyle gỡ style ẩn khi !enabled → caption gốc trở lại; applySettings/onMessage/syncTick guard (tắt→removeOverlay, vẫn lưu cues; bật lại→dựng NGAY qua onSettingsChange→applySettings). popup footerNode +nút '⏻ Tắt/Bật StudyMovie' (getSettings label + setSettings realtime).
- **C — leaderboard top5** (app/leaderboard): top5=data.top.slice(0,5); ghim dòng user nếu ngoài top5 (meInTop hạng 6-20, hoặc data.caller ngoài 20); trong top5→không ghim; giữ zero-state. KHÔNG đổi backend/RPC.
- **Verification (AC-D):** init.sh exit 0; FE build (/thanh-toan 3.79k, /leaderboard 3.13k); backend 21/21; ext build OK + KEY service_role thật KHÔNG trong dist.
- **CHỜ HOMEOWNER:** A countdown→hết hạn→tạo mã mới (+CK OK vẫn /cam-on); B bật/tắt overlay realtime + caption gốc trở lại + bền reload; C bảng ≤5 + ghim đúng.
- **Commit:** feat: TIP-028 payment countdown + master subtitle toggle + leaderboard top5.

### Session 31 — TIP-027 Extension đăng nhập/đăng ký email+mật khẩu (2026-06-30)
- **TIP/Feature:** TIP-027 — EXT-AUTH2. ĐẢO QĐ Google-only → THÊM email/mật khẩu (CÓ xác nhận email). CHỈ sửa popup (popup.ts renderLogin + popup.html CSS; KHÔNG đụng auth-bridge/service-worker/apiExt/supabaseExt/settings).
- **Đã làm:**
  - `renderLogin(notice?)` mới: authMode login↔register; ô email + mật khẩu + submit 'Đăng nhập'/'Tạo tài khoản' + link đổi mode + phân cách 'hoặc' + nút Google (giữ openTab(SITE_URL)) + auth-msg (ok/err).
  - Đăng nhập: `supabaseExt.auth.signInWithPassword` → session ghi chrome.storage → onChanged listener tự render user view (không tự render). Đăng ký: `signUp`; confirm ON → !session → về mode login + báo 'Đã gửi email xác nhận…'.
  - Validate client: email regex + mật khẩu ≥6. mapAuthError (Invalid credentials/Email not confirmed/already registered → tiếng Việt). CSS auth-input/title/msg/divider/link.
- **Verification (AC-8):** init.sh exit 0; ext build OK (popup.js 772k); **SECURITY: KEY service_role thật KHÔNG có trong dist** (17 match chỉ là chuỗi cảnh báo lib supabase-js), anon key inline OK.
- **CHỜ HOMEOWNER (Supabase TRƯỚC test):** Authentication→Providers→Email: bật + Confirm email ON; URL Configuration→Redirect URLs: thêm SITE_URL (localhost:3000 + Vercel prod). Rồi test Chrome AC-1..7 (form, đăng ký email thật→mail xác nhận→đăng nhập→user view, sai mật khẩu, Google mở web, đăng xuất về form).
- **Lưu ý:** bật Email provider dùng chung Supabase với web — web chưa có form email nên không đổi (vẫn Google), đúng scope.
- **Commit:** feat(ext): TIP-027 email/password auth in popup.

### Session 30 — TIP-026 Flashcard swipe + học từ đã chọn + mark-learned (2026-06-30)
- **TIP/Feature:** TIP-026 — WEB-FLASH2. ĐẢO QĐ cũ (Homeowner duyệt): flashcard NÚT→SWIPE, học TẤT CẢ→thêm chọn-từ. backend endpoint + frontend (KHÔNG migration).
- **Đã làm:**
  - **Backend** vocabulary.ts: `POST /api/vocabulary/mark-learned {ids}` (getUserClient/RLS; update learned_at=now() where id in ids AND learned_at IS NULL → idempotent; rỗng→no-op 200; requireAuth→401). Wire app.ts. +test mark-learned 401 (backend 21/21).
  - **lib/vocabulary.ts:** markLearned(ids) + STUDY_SELECTION_KEY.
  - **Flashcard /hoc-tu-vung** rewrite: SWIPE pointer events (ngưỡng 90px; kéo phải→thẻ sau, trái→trước, chưa đủ→nảy về; transform translateX+rotate; chạm<6px→lật) — BỎ nút ←/→; audio tự phát giữ; tutorial sửa thành 'kéo'; thẻ mới hiện → markLearned([id]) fire-and-forget; ≡ menu (3 route); selection: đọc sessionStorage sm-study-selection → học chỉ ids (rỗng→tất cả).
  - **/tu-vung:** cột 'Học từ này?' checkbox/dòng + nút 'Học các từ đã chọn (N)' (lưu ids→sessionStorage→/hoc-tu-vung, disable khi 0) + Flashcard=học tất cả (xóa selection). Giữ search/lọc/phân trang TIP-025.
- **Verification (AC-8):** init.sh exit 0; FE build (/hoc-tu-vung 4.47k, /tu-vung 5.54k); backend 21/21.
- **CHỜ HOMEOWNER:** swipe đổi thẻ; chọn từ→học đúng; xem thẻ→reload /tu-vung 'Đã học' + biểu đồ tăng; ≡ menu; quiz/list/lọc chạy.
- **Lưu ý:** ngưỡng swipe 90px; mark-learned gọi NGAY khi thẻ hiện ('từ đã xem' theo spec), idempotent; selection qua sessionStorage 'sm-study-selection'.
- **Commit:** feat(web): TIP-026 flashcard swipe + study-selected + mark-learned.

### Session 29 — TIP-025 Vocab search/lọc/phân trang/biểu đồ (FE-only) (2026-06-30)
- **TIP/Feature:** TIP-025 — WEB-VOCAB2. CHỈ app/tu-vung/page.tsx (KHÔNG backend/supabase/migration; KHÔNG thư viện — CSS thuần). Tính client từ list fetchVocab.
- **Đã làm:**
  - **Biểu đồ** LearnedChart: 7 ngày gần nhất (UTC+7 qua dayKeyVN = +7h rồi lấy ngày UTC), đếm từ learned_at rơi vào ngày; cột cao nhất bg-chart-bar, còn lại base; nhãn dd/MM. **Vòng tròn** TotalLearnedRing: đếm learned_at != null.
  - **Search** (word|meaning_vi, lowercase includes). **Lọc trạng thái** (Tất cả/Từ mới=null/Đã học=!null). **Lọc ngày thêm** (created_at UTC+7 = parseVNDate DD/MM/YYYY) + Áp dụng + Xóa lọc + báo ngày sai. Lọc **AND** (useMemo).
  - **Phân trang** PAGE_SIZE=10: slice, 'Hiển thị X–Y trong tổng số N từ vựng' + ‹ ›(disable biên) + trang/pageCount; reset page=1 khi đổi search/status/dateApplied.
  - GIỮ form thêm từ/xóa/🔊/3 nút Flashcard-Quiz — flashcard/quiz vẫn dùng TOÀN BỘ từ (search/lọc chỉ áp lên view bảng).
- **Verification (AC-7):** lint+typecheck sạch; FE build (/tu-vung 5.23kB).
- **CHỜ HOMEOWNER:** test web (set tay vài learned_at để thấy biểu đồ/vòng; search; lọc trạng thái+ngày; phân trang; flashcard/quiz dùng full).
- **Lưu ý:** pageSize=10; UTC+7 = cộng 7h rồi .toISOString().slice(0,10).
- **Commit:** feat(web): TIP-025 vocab search + filters + pagination + learned chart.

### Session 28 — TIP-024 Vocab status Từ mới/Đã học + thêm từ web + reskin bảng (2026-06-30)
- **TIP/Feature:** TIP-024 — WEB-VOCAB. supabase migration + backend + frontend. Self-tested; chờ Homeowner áp migration 010 + test.
- **Đã làm:**
  - **DB** (migration `20260629000010_vocab_learned.sql`): vocabulary + `learned_at timestamptz` (null='Từ mới', có='Đã học'). KHÔNG đổi RLS.
  - **Backend** vocabulary.ts: GET select thêm learned_at (giữ order created_at desc); POST giữ idempotent + lemma fallback word.toLowerCase() khi thêm thủ công; learned_at để DB default null.
  - **Frontend** lib/vocabulary.ts (+learned_at, addVocab) + app/tu-vung reskin: bảng STT|Từ vựng(+ipa/🔊)|Nghĩa|Ngày thêm|Trạng thái<Badge Từ mới=danger/Đã học=success>|🗑️ mới-nhất-trước; form 'Thêm từ vựng' (Từ EN + Nghĩa VI + Lưu) → addVocab → list refresh + clear; trùng→'đã có từ này'; validate rỗng; giữ 3 nút Flashcard/Quiz + empty state.
- **NGOÀI scope:** search/lọc/phân trang/biểu đồ = TIP-025; checkbox chọn-từ/mark-learned = TIP-026.
- **Verification (AC-6):** init.sh exit 0 (lint+typecheck 3 pkg); FE build (/tu-vung 3.97kB); backend 20/20.
- **CHỜ HOMEOWNER:** áp migration 010 (SQL in trong report) + test (thêm từ→Từ mới ở đầu; trùng báo; pill trạng thái; xóa; 3 nút). Giả lập 'Đã học': `update vocabulary set learned_at=now() where word='...'`.
- **Commit:** feat(web): TIP-024 vocab learned status + manual add + list reskin.

### Session 27 — TIP-023 Phụ đề ext: chế độ + màu chữ EN/VI + khoảng cách + né control (2026-06-30)
- **TIP/Feature:** TIP-023 — EXT-SUBTITLE. CHỈ extension (settings.ts + popup.ts + youtube.ts; KHÔNG đụng web/backend/supabase; KHÔNG đổi logic cue/click-từ/auth/timer).
- **Đã làm:**
  - **settings.ts model mới:** {mode'en|both|vi', enColor/viColor'white|black|yellow', bgEnabled, bgOpacity, fontSizePx(EN), lineGapPx}. Giữ key `sm-ext-settings`. MIGRATE TIP-015: showEn&&showVi→both, chỉ EN→en, chỉ VI→vi (field cũ bỏ qua, không crash). COLOR_HEX + clampGap(2..16 bước2).
  - **popup buildSettingsCard:** tabs segmented (Tiếng Anh/Song ngữ/Tiếng Việt); hàng màu chữ 🇬🇧/🇻🇳 (3 chấm trắng/đen/vàng) hiện theo mode; Màu nền toggle+slider%; stepper Kích thước (EN 12..32); stepper Khoảng cách (2..16) CHỈ mode=both. CSS .seg/.seg-btn/.dots/.dot-btn. Mỗi đổi → setSettings realtime + re-render (ẩn/hiện hàng theo mode).
  - **youtube.ts overlay:** render theo mode; màu theo enColor/viColor (COLOR_HEX); VI size = round(EN*0.8); marginTop VI = lineGapPx khi có cả EN; pill nền giữ (text-shadow theo màu khi tắt nền). NÉ CONTROL: `updateOverlayPosition()` đọc #movie_player `.ytp-autohide`(control ẩn) + fullscreen(`document.fullscreenElement`|`.ytp-fullscreen`) → bottom thường ẩn20/hiện60, FS ẩn24/hiện80; gọi trong syncTick(250ms)+fullscreenchange; transition .2s.
  - GIỮ cue max-start / anti-bot VI / click-từ / dựng lại đổi video.
- **Verification (AC-1/8):** init.sh exit 0 (lint+typecheck 3 pkg); ext build OK (popup.js 769k, youtube.js 14.9k).
- **CHỜ HOMEOWNER (AC-2..7 Chrome):** tabs/màu/size/gap realtime + né control ẩn/hiện + full screen + click-từ.
- **Selector phát hiện control (rà nếu YouTube đổi DOM):** `.ytp-autohide` trên #movie_player = control ẩn; `.ytp-fullscreen`/document.fullscreenElement = full screen.
- **Commit:** feat(ext): TIP-023 subtitle mode + per-line color + line gap + control-aware position.

### Session 26 — TIP-022 Reskin extension (popup + overlay phụ đề) (2026-06-30)
- **TIP/Feature:** TIP-022 — EXT-RESKIN. UI-ONLY extension (KHÔNG đụng web/backend/supabase; KHÔNG đổi model settings TIP-015/logic timer/auth/lookup). Đối chiếu Figma\\Extension (8) + Phụ đề (7).
- **Đã làm:**
  - **popup.html:** tokens theme sáng (primary #111827, accent #f5b301, surface #fff, border #e5e7eb, radius card16/btn10, shadow, Inter). Class .card / .timer-card / .tbtn (nút tròn 52px) / .footer / .logo / restyle switch+stepper.
  - **popup.ts:** logo 'SM.' chấm vàng (thay title 'StudyMovie' ở mọi state); buildTimerCard → 2 nút TRÒN ▶/■ + label dưới (GIỮ onStart/onStop TIP-014); buildSettingsCard title 'Chế độ phụ đề' (GIỮ control TIP-015: switch EN/VI + Màu nền slider% + cỡ chữ ±); footer Đăng xuất + Hỗ trợ (→ /ho-tro).
  - **youtube.ts overlay:** 1 PILL bo tròn nền đen (rgba theo bgOpacity%) ôm cả EN+VI; EN đậm trắng (700), VI opacity .82 + 0.9× cỡ; tắt nền → trong suốt + text-shadow. GIỮ logic cue max-start / anti-bot VI / click-từ tra-lưu / ẩn-hiện theo settings.
- **NGOÀI scope (để TIP sau):** email/mật khẩu login = TIP-027 (giữ Google-only); field settings mới + tab 'Tiếng Anh/Song ngữ/Tiếng Việt' + reposition né control + VI=80%/khoảng cách chính xác = TIP-023; nút 'Tắt StudyMovie' = TIP-028.
- **Verification (AC-1/5):** init.sh exit 0 (lint+typecheck 3 pkg); ext build OK (popup.js 766k, youtube.js 13.1k).
- **CHỜ HOMEOWNER (AC-2/3/4 Chrome):** load extension/dist → popup khớp Figma + timer/settings chạy; overlay pill EN/VI + biến thể không nền khớp + click-từ/đổi video chạy.
- **DEVIATION:** VI nhỏ/nhạt tĩnh (0.9×/.82) — tinh chỉnh chính xác = TIP-023; footer thêm Hỗ trợ (khớp Figma); login Google-only (email = TIP-027).
- **Commit:** feat(ext): TIP-022 reskin extension popup + subtitle overlay.

### Session 25 — TIP-021 Reskin web (design system theme sáng + pill nav) (2026-06-30)
- **TIP/Feature:** TIP-021 — WEB-RESKIN. UI-ONLY (chỉ web/frontend; KHÔNG đụng backend/supabase/extension/route/API/logic/text). Đối chiếu Figma\\Webapp (20 PNG).
- **Đã làm:**
  - **Tokens** (`app/globals.css` @theme — đòn bẩy chính, đa số trang tự reskin): theme sáng — primary #111827, accent #f5b301 (chấm logo), background #fafafa, surface #fff, border #e5e7eb, muted #6b7280, semantic info/success/danger, level-ring #7c3aed, chart-bar #60a5fa/base #e5e7eb, radius card16/btn10/pill, shadow-card. Font **Inter** next/font (subsets vietnamese) ở layout.tsx.
  - **Primitives:** Button +info/success/danger/outline; Badge mới (Từ mới=danger/Đã học=success); Card/Avatar/Spinner đổi qua token.
  - **Header:** nav PILL bo tròn trắng + shadow, logo 'SM.' đen + chấm accent; giữ MAIN_NAV + dropdown avatar (Playlist/BXH/Cài đặt/Admin/Đăng xuất) — KHÔNG đổi route.
  - **Dashboard:** ProgressRing tím (stroke-level-ring); BarChart cột cao nhất xanh chart-bar.
  - **QuizGame:** 2 cột (card hỏi trái + chấm đen, 4 đáp án phải) màu token (đúng=success, sai=danger) — GIỮ logic chấm điểm.
  - login/leaderboard/settings/playlist/thanh-toan/cam-on/admin reskin qua token.
- **NGOÀI scope (mục 5):** KHÔNG reskin sâu /tu-vung + /hoc-tu-vung (chỉ token toàn cục — restructure ở TIP-024/025/026).
- **Verification (AC-5):** lint+typecheck+build PASS (14 route, Inter nạp).
- **VERIFIED (Homeowner browser local 2026-06-30):** AC-2 nav pill+logo+dropdown không 404, AC-3 các trang khớp Figma, AC-4 thao tác không vỡ — PASS. Chủ thầu duyệt deviation (token baseline + QuizGame 2 cột).
- **DEVIATION (Chủ thầu đã rà & chấp nhận):** token hex suy từ baseline TIP-021 (chưa có hex Figma chính thức); QuizGame 1 cột→2 cột (style, giữ logic).
- **Commit:** feat(web): TIP-021 reskin web design system + app shell (b864873) + chore verified.

### Session 24 — TIP-019b + TIP-020 VERIFIED production + push (2026-06-30)
- **TIP/Feature:** WEB-TRIAL (TIP-019b) + WEB-ADMIN (TIP-020) → **verified**.
- **Homeowner đã làm:** áp migration 008 (trước) + 009 (admin) + bootstrap `update profiles set is_admin=true where email='dokhiem562@gmail.com'` qua Supabase SQL Editor; query kiểm tra OK; test browser production PASS.
- **Test PASS (Homeowner):** 019b — trial hết hạn→/thanh-toan, public không chặn, Pro vào /thanh-toan báo đã Pro. 020 — admin /admin xem stats/users, set giá→đơn áp giá mới+QR, gán Pro, toggle admin (chặn tự gỡ admin mình), user thường /admin→đẩy /dashboard.
- **Thợ làm:** feature_list WEB-TRIAL + WEB-ADMIN → verified (+ evidence verified). progress cập nhật trạng thái tổng quan + entry này. Push 2 commit local (f245086 019b + 83cb3c2 020) + commit state lên origin/main.
- **Lưu ý:** Supabase MCP của Thợ Unauthorized (không có access token) → migration do Homeowner áp tay; nếu sau muốn Thợ tự áp cần cấp SUPABASE_ACCESS_TOKEN hoặc DB url.
- **Kế tiếp:** Chờ Chủ thầu giao TIP-021 (reskin). Sau đó QA-01 + INF-02 (đóng gói + handover).
- **Commit:** chore: WEB-TRIAL + WEB-ADMIN verified (TIP-019b + TIP-020).

### Session 23 — TIP-020 Admin panel (stats, users, giá Pro DB, gán Pro, quản admin) (2026-06-30)
- **TIP/Feature:** TIP-020 — WEB-ADMIN. Không tách (chủ yếu additive; điểm chạm rủi ro = giá Pro→DB, đã giữ fallback env). Self-tested; chờ Homeowner áp migration + bootstrap + test.
- **⚠️ BẢO MẬT (trọng tâm) — FAIL-CLOSED:** migration `20260629000009_admin.sql`: profiles.is_admin (default false) + app_settings (key-value, RLS bật KHÔNG policy authenticated → client không đọc/ghi trực tiếp) + helper `is_caller_admin()` (coalesce false). MỌI RPC admin (security definer) check `if not is_caller_admin() then raise 'forbidden'` ở ĐẦU hàm — không dựa UI. RPC: admin_get_stats, admin_list_users, admin_set_pro_price, admin_grant_pro (cộng dồn max(now,paid)+days), admin_set_admin (KHÔNG cho tự gỡ admin chính mình → tránh tự khóa). Grant execute authenticated nhưng bảo mật ở TRONG hàm.
- **Backend:** `api/admin.ts` proxy 5 RPC qua getUserClient; 'forbidden'→403. Routes /api/admin/{stats,users,price,grant-pro,set-admin}.
- **Giá Pro → DB:** `payment.ts` getProPrice đọc app_settings.pro_price (service client) → fallback env PRO_PRICE (KHÔNG vỡ TIP-013); create-order dùng price cho amount + buildVietQrUrl.
- **Frontend:** `lib/admin.ts` + `app/admin/page.tsx` (AuthGuard + 403→/dashboard): thống kê (total/pro/revenue), bảng user (email/ngày/status/hạn Pro/admin toggle/gán Pro+ngày), form set giá. Header dropdown thêm link Admin chỉ khi me.profile.is_admin. account.ts Me.profile thêm is_admin. me.ts select('*') tự có is_admin.
- **Verification (tự test):** backend lint+typecheck+20test; FE lint+typecheck sạch; admin routes 401 no-auth (không 404). (Không next build vì dev chạy.)
- **CHỜ HOMEOWNER:** áp migration 009 + BOOTSTRAP `update profiles set is_admin=true where email='dokhiem562@gmail.com'` + test admin/bảo mật (user thường /admin bị chặn + API 403) + set giá→tạo đơn áp giá mới + QR chạy + gán Pro + toggle admin.
- **Commit:** feat(web): TIP-020 admin panel.

### Session 22 — TIP-019b Trial 24h + access guard + Pro guard (2026-06-30)
- **TIP/Feature:** TIP-019b — WEB-TRIAL (mảnh 2 của TIP-019). Self-tested; chờ Homeowner áp migration 008 + test web.
- **Đã làm:**
  - **DB** (migration `20260629000008_access_status.sql`): RPC `get_access_status` (security definer, auth.uid) — profiles.created_at + subscriptions.paid_until (left join); has_access = paid_until>now (paid) OR now<created_at+24h (trial) else expired; trả trial_expires_at/paid_until.
  - **Backend** `api/access.ts` GET `/api/access-status` (getUserClient→RPC), wire app.ts.
  - **Frontend** `lib/access.ts`; `components/AccessGuard.tsx` đặt trong `app/layout.tsx` bọc {children}: pathname-based, chỉ chặn 8 trang học → has_access=false → router.replace(/thanh-toan). KHÔNG chặn /,/thanh-toan,/cam-on,/ho-tro,/blog (tránh loop); chưa login để AuthGuard lo; lỗi API fail-open; loading nhẹ.
  - **Pro guard** /thanh-toan: reason=paid → 'Bạn đã là Pro (hạn đến X)' + Vào học, không tạo đơn.
  - Config `NEXT_PUBLIC_PAYWALL_REDIRECT` (next.config env + .env.example).
- **Verification (tự test):** backend lint+typecheck+20test; FE lint+typecheck sạch; /api/access-status 401 no-auth. (Không next build vì dev đang chạy.)
- **CHỜ HOMEOWNER:** áp migration 008 + test (trial còn/hết → chặn, paid vào được, public không chặn, Pro guard). Giả lập expired: tạm paid_until=null + created_at lùi >24h cho tài khoản test.
- **Commit:** feat(web): TIP-019b 24h trial + access guard + pro guard.

### Session 21 — TIP-019a Routing tiếng Việt + /cam-on + redirect + nav (2026-06-29)
- **TIP/Feature:** TIP-019a — WEB-ROUTE (mảnh 1 của TIP-019 đã tách; 019b trial guard làm sau). Self-tested; chờ Homeowner test web. Frontend-only, không migration.
- **3 điểm lệch giả định TIP (đã chốt với khách trước khi làm):** (1) quiz 1 route+?mode chứ không 2; (2) `/`=login, dashboard ở /dashboard; (3) paid_until ở subscriptions không phải profiles. Cả 3 đã duyệt.
- **Đã làm:**
  - **Route VN canonical** (git mv giữ history): /tu-vung(←vocabulary), /hoc-tu-vung(←vocabulary/flashcard), /thanh-toan(←upgrade). Quiz: `components/QuizGame.tsx` (direction prop) dùng chung cho /kiem-tra-anh-viet (en2vi) + /kiem-tra-viet-anh (vi2en); xóa app/vocabulary/quiz.
  - **Redirect** (next.config `redirects()`): /vocabulary→/tu-vung, /vocabulary/flashcard→/hoc-tu-vung, /vocabulary/quiz(?mode=vi2en→/kiem-tra-viet-anh; else→/kiem-tra-anh-viet), /upgrade→/thanh-toan, /ho-tro→FB thaytruongtienganh, /blog→NEXT_PUBLIC_BLOG_URL (mặc định studymovie.com/blog).
  - **/cam-on** (mới): trang cảm ơn + "Vào học"→/dashboard. /thanh-toan khi paid → router.push('/cam-on').
  - **Nav** (Header): Tiến độ học(/dashboard)/Từ vựng(/tu-vung)/Blog/Hỗ trợ + dropdown avatar (Playlist/Bảng xếp hạng/Cài đặt/Đăng xuất) — không mất truy cập.
  - Cập nhật mọi link nội bộ; .env.example thêm NEXT_PUBLIC_BLOG_URL.
- **KHÔNG đụng:** dashboard/login/leaderboard/settings/playlist path, trial guard (019b), reskin (021), extension (/upgrade tự redirect).
- **Verification (tự test):** lint+typecheck sạch; FE build OK (6 route VN xuất hiện, route cũ thành redirect).
- **CHỜ HOMEOWNER (web):** route VN đúng trang; path cũ redirect; /cam-on sau thanh toán; /ho-tro→FB, /blog→blog; nav + Settings/Playlist còn vào; tính năng cũ chạy.
- **Commit:** feat(web): TIP-019a vietnamese routing + /cam-on + redirects + nav.

### Session 20 — TIP-018 Flashcard hướng dẫn lần đầu + audio tự phát (2026-06-29)
- **TIP/Feature:** TIP-018 — WEB-FLASH: thêm overlay hướng dẫn lần đầu + audio tự phát cho trang flashcard. Self-tested; chờ Homeowner test web. (Frontend-only, không migration.)
- **Đọc code cũ:** flashcard (`app/vocabulary/flashcard/page.tsx`) tương tác = NÚT (click thẻ lật + ← Trước/Sau →), KHÔNG kéo; đã có nút 🔊 thủ công (new Audio(audio_url)) chỉ hiện khi có URL; chưa tự phát.
- **Đã làm (chỉ page flashcard):**
  - **Hướng dẫn lần đầu:** localStorage `sm-flashcard-tutorial-seen`; chưa có → overlay (nền mờ) mô tả ĐÚNG nút bấm (không ghi 'kéo' — AC-3) + "Bắt đầu" → set key → vào học; lần sau bỏ qua. Nút nhỏ "Hướng dẫn" xem lại.
  - **Audio tự phát:** useEffect [idx, items, showTutorial] → playWord khi sang thẻ mới (không phát khi đang xem hướng dẫn / không phát lại khi lật). playWord: ưu tiên audio_url → lỗi/không có → fallback speechSynthesis (en-US). try/catch + p.catch() nuốt lỗi autoplay (AC-5 không vỡ UI). Nút loa thủ công giữ (luôn hiện, gọi playWord).
  - KHÔNG đổi tương tác/logic flashcard (lật/chuyển/học tất cả/2 chiều/quiz).
- **Verification (tự test):** lint+typecheck sạch; FE build OK (/vocabulary/flashcard 3.61kB). (Không init.sh đầy đủ vì chỉ đụng FE — nhưng FE gate đã chạy.)
- **CHỜ HOMEOWNER (web):** xóa localStorage → hướng dẫn lần đầu → Bắt đầu → học; chuyển thẻ nghe audio tự phát; nút loa phát lại; vào lại không hiện; flashcard cũ chạy đúng.
- **Commit:** feat(web): TIP-018 flashcard first-time tutorial + auto audio.

### Session 19 — TIP-017 Kế hoạch tuần này (Dashboard) (2026-06-29)
- **TIP/Feature:** TIP-017 — WEB-PLAN: bảng "Kế hoạch tuần này" dưới Dashboard. Self-tested; chờ Homeowner áp migration 007 + test web.
- **Đã làm:**
  - **DB** (migration `20260629000007_weekly_plans.sql`): bảng RIÊNG `weekly_plans` (id, user_id FK auth.users, plan_date/video_link/committed_time text, done bool, created_at). RLS 4 policy auth.uid()=user_id + grant authenticated + index(user_id). KHÔNG đụng playlist_items.
  - **Backend** `api/weekly-plan.ts` (getUserClient/RLS): GET list, POST add, PATCH (sửa fields hoặc toggle done), DELETE. Wire app.ts (/api/weekly-plan + /:id).
  - **Frontend** `lib/weeklyPlan.ts` + `components/WeeklyPlan.tsx` (`WeeklyPlanTable`) render dưới biểu đồ dashboard: bảng (sửa/xóa | Ngày | Link | Thời gian cam kết | Hoàn thành?), mọi ô input text, link clickable target=_blank rel=noopener, checkbox done lưu ngay, ✏️ sửa inline (💾/✖️), 🗑️ xóa (confirm), form "Thêm dòng" (3 input + Lưu/Huỷ — KHÔNG auto-save), empty state.
- **Verification (tự test):** init.sh exit 0 (lint+typecheck 3 pkg); FE build OK (/dashboard 5.49kB); backend 20/20.
- **CHỜ HOMEOWNER:** áp migration 007 (SQL in trong report) + test web (AC-1..8): thêm/sửa/xóa/tick/link/reload/RLS; dashboard cũ đúng.
- **Commit:** feat(web): TIP-017 weekly plan table (CRUD, RLS).

### Session 18 — TIP-016 Level system Dashboard (2026-06-29)
- **TIP/Feature:** TIP-016 — WEB-LEVEL: card "Level hiện tại" + "Mục tiêu tiếp theo" (vòng tròn) trên Dashboard. Self-tested; chờ Homeowner áp migration + test web.
- **Bảng giờ mục tiêu (lên cấp kế):** A0→A1=95h, A1→A2=95h, A2→B1=185h, B1→B2=175h, B2→C1=200h, C1→C2=350h. C2=cao nhất.
- **Đã làm:**
  - **DB** (migration `20260629000006_level_system.sql`): profiles + `current_level` (CHECK A0..C2) + `level_started_at`. RPC `set_current_level(p_level)` (set + reset mốc now()). RPC `get_level_progress()` (security definer/auth.uid): needs_input nếu null; **giờ RESET mỗi cấp** = sum(duration_sec) study_sessions started_at ≥ level_started_at; target theo bảng; **TỰ LÊN CẤP 1 cấp/lần** (side-effect update current_level=next + level_started_at=now) trả just_leveled_up/old/new; C2 → is_max; percent/remaining.
  - **Backend:** `api/level.ts` GET/POST `/api/level` (getUserClient RPC), wire `app.ts`.
  - **Frontend:** `lib/level.ts`; `dashboard/page.tsx` thêm `<LevelSection/>` (2 card) + `ProgressRing` (SVG %, tooltip 'giờ mục tiêu/còn lại') + `LevelPicker` (nhập lần đầu + 'Đổi level') + banner '🎉 lên cấp {new}'. Dashboard cũ (streak/giờ/biểu đồ) KHÔNG đụng (RPC riêng).
- **Side-effect (ghi rõ):** get_level_progress UPDATE profiles khi đủ giờ (tự lên cấp). 1 cấp mỗi lần gọi.
- **Verification (tự test):** init.sh exit 0 (lint+typecheck 3 pkg); FE build OK (/dashboard 4.36kB); backend 20/20 test.
- **CHỜ HOMEOWNER:** áp migration 006 (SQL in trong report) + test web login: nhập level (A1→mục tiêu A2/95h), vòng tròn %, tự lên cấp (verify nhanh: chọn level + insert study_sessions test hoặc tạm bằng giờ đã có), dashboard cũ đúng.
- **Commit:** feat(web): TIP-016 level system (current/target level, auto level-up).

### Session 17 — TIP-015 Cài đặt phụ đề trong popup (2026-06-29)
- **TIP/Feature:** TIP-015 — EXT-04 dời cài đặt phụ đề từ panel gear (player) sang POPUP (Figma + khách Truong Luc). Self-tested; chờ Homeowner test Chrome.
- **Đọc code cũ:** TIP-005 `settings.ts` (key `sm-ext-settings`) {enabled,mode,fontSize,textColor,bgColor,bgOpacity(0..1)} + panel gear 📖 trong player (toggleSettingsPanel).
- **Đã làm:**
  - **settings.ts:** GỘP 1 nguồn (giữ key `sm-ext-settings`, không tạo trùng) → model mới `{showEn,showVi,bgEnabled,bgOpacity%(0..100),fontSizePx}` + `normalize`/`clampFont` (12..32 bước 2). Field cũ trong storage bị bỏ qua (migrate về default).
  - **Popup** (`popup.ts`+`.html`): card "Cài đặt" = 2 switch EN/VI + toggle "Màu nền"+slider % (disable khi tắt) + stepper − [Npx] + (clamp+disable biên). Mỗi đổi → `setSettings` → chrome.storage. CSS switch/slider/stepper.
  - **youtube.ts:** `onSettingsChange` → `applySettings` re-render cue hiện tại NGAY: showEn/showVi ẩn-hiện dòng, nền `rgba(0,0,0,%/100)` (tắt → transparent + textShadow), `fontSizePx`. GỠ `buildGear`/`toggleSettingsPanel`/`hexToRgba`/`row` (panel cũ trùng + dùng model đã bỏ). GIỮ nguyên cue/click-từ/anti-bot VI.
- **Deviation (flag):** gỡ panel gear trong player — vì cài đặt giờ ở popup (Figma) và panel cũ dùng model đã bỏ. Nếu khách muốn giữ gear in-player → yêu cầu mới.
- **Verification (tự test):** init.sh exit 0 (lint+typecheck 3 pkg); ext build dev OK (youtube.js 16.8→12.8kb sau gỡ gear).
- **CHỜ HOMEOWNER (Chrome):** AC-1 toggle EN/VI realtime; AC-2 độ đậm nền; AC-3 cỡ chữ 12-32 bước 2; AC-4 bền qua đóng/mở popup+reload; AC-5 click-từ vẫn chạy; AC-6 timer không ảnh hưởng.
- **Commit:** feat(ext): TIP-015 subtitle settings (toggle EN/VI, bg opacity, font size).

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
