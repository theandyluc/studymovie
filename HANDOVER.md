# HANDOVER.md — StudyMovie

> Tài liệu bàn giao kỹ thuật. Bàn giao theo **Cách B**: transfer toàn bộ dịch vụ (GitHub +
> Supabase + Vercel) sang tài khoản khách và **xoay toàn bộ key**. File này KHÔNG chứa secret thật
> — chỉ tên biến + hướng dẫn. Đọc kèm `CLAUDE.md`, `StudyMovie-Blueprint.md`, `feature_list.json`.

---

## 1. Tổng quan kiến trúc

StudyMovie giúp người Việt học tiếng Anh qua YouTube (phụ đề song ngữ) + ôn từ vựng trên web.
Gồm 3 khối dùng chung 1 tài khoản Google + 1 database Supabase:

```
┌─ Chrome Extension (MV3) ─┐        ┌─ Web App (Next.js 15) ─┐
│ extension/               │        │ web/frontend/          │
│ phụ đề YouTube + popup   │        │ app.studymovie.com     │
└──────────┬───────────────┘        └───────────┬────────────┘
           │      gọi API (Bearer JWT)          │
           └──────────────┬────────────────────-┘
                          ▼
              ┌─ Backend API (Hono) ─┐
              │ web/backend/         │  studymovie-backend.vercel.app
              │ tầng giữa dùng chung │
              └──────────┬───────────┘
                         ▼
              ┌─ Supabase (Singapore) ─┐
              │ Postgres + Auth + RLS  │  ref: ojsdchkwfzhmzvmwlgmo
              └────────────────────────┘
```

- **Landing page** `studymovie.com` = repo/dự án **riêng của khách** (không thuộc bàn giao này).
- **Web app** `app.studymovie.com` = `web/frontend` (Vercel).
- **Backend** `studymovie-backend.vercel.app` = `web/backend` (Vercel, serverless).
- Chi tiết thiết kế/data model/REQ: `StudyMovie-Blueprint.md`.

---

## 2. Repo & dịch vụ

| Dịch vụ | Định danh | Ghi chú |
|---|---|---|
| GitHub | repo StudyMovie (monorepo) | npm workspaces: extension + web/frontend + web/backend + supabase |
| Vercel — Frontend | project `studymovie-frontend` | domain `app.studymovie.com` |
| Vercel — Backend | project `studymovie-backend` | serverless Hono, domain `studymovie-backend.vercel.app` |
| Supabase | ref `ojsdchkwfzhmzvmwlgmo` (Singapore) | Postgres + Auth + RLS + RPC |
| Google Cloud | OAuth Client (đăng nhập Google) | Authorized origins + redirect (Supabase callback) |
| SePay | webhook thanh toán VietQR | header `Authorization: Apikey <key>` |

---

## 3. Biến môi trường

> Giá trị thật KHÔNG nằm ở đây — copy `.env.example` → `.env` (local) và nhập ở **Vercel Dashboard**
> (production). Extension bản prod đọc `extension/.env.production` (xem `extension/.env.production.example`).

### 3.1 Vercel project FRONTEND (`web/frontend`)

| Biến | Mô tả |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key Supabase (công khai, an toàn client) |
| `NEXT_PUBLIC_BACKEND_URL` | URL backend Vercel (`https://studymovie-backend.vercel.app`) |
| `NEXT_PUBLIC_SITE_URL` | `https://app.studymovie.com` |
| `NEXT_PUBLIC_BLOG_URL` | URL blog (landing khách, `https://studymovie.com/blog`) |
| `NEXT_PUBLIC_PAYWALL_REDIRECT` | đường dẫn khi hết quyền (mặc định `/thanh-toan`) |

### 3.2 Vercel project BACKEND (`web/backend`)

| Biến | Mô tả |
|---|---|
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_ANON_KEY` | Anon key (backend tạo user-client để RPC nhận `auth.uid()`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **BÍ MẬT** — chỉ backend, bỏ qua RLS. KHÔNG để lộ client. |
| `NEXT_PUBLIC_SITE_URL` | `https://app.studymovie.com` — dùng cho **CORS** (bắt buộc, nếu sai web bị chặn) |
| `SEPAY_API_KEY` | verify webhook SePay |
| `BANK_ID` | mã ngân hàng VietQR (vd `970422`) |
| `BANK_ACCOUNT_NO` | số tài khoản nhận |
| `BANK_ACCOUNT_NAME` | tên chủ tài khoản |
| `VIETQR_TEMPLATE` | mẫu ảnh QR (`compact2`) |
| `PRO_PRICE` | giá gói Pro (VND, vd `49000`) |
| `PRO_DURATION_DAYS` | số ngày gói Pro (vd `30`) |
| `OPENAI_API_KEY` | **BÍ MẬT** — key OpenAI cho tính năng "nghĩa theo ngữ cảnh" (model `gpt-4o-mini`). CHỈ backend. **Thiếu key → tự fallback** sang nghĩa từ điển (không lỗi). Chi tiết + cách đặt/đổi/tắt: xem **mục 3.5**. |
| `PORT` | (tùy chọn) cổng local, mặc định 8787 — Vercel không cần |

### 3.3 Extension bản production (`extension/.env.production`, GITIGNORE — KHÔNG commit)

| Biến | Mô tả |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | = URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | = anon key |
| `NEXT_PUBLIC_SITE_URL` | `https://app.studymovie.com` |
| `NEXT_PUBLIC_BACKEND_URL` | `https://studymovie-backend.vercel.app` |

### 3.4 Google OAuth (cấu hình ở Supabase Auth + Google Cloud, không đọc trong code)

| Biến (tài liệu) | Mô tả |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Client ID (nhập vào Supabase Auth → Google provider) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Client Secret (Supabase Auth) |

### 3.5 Tính năng AI — nghĩa từ theo NGỮ CẢNH (OpenAI GPT-4o-mini)

**Là gì:** Khi người học bấm vào 1 từ trong phụ đề YouTube, backend gọi OpenAI (model `gpt-4o-mini`)
đọc cả câu để trả về **DUY NHẤT 1 nghĩa tiếng Việt đúng ngữ cảnh** (thay vì liệt kê nhiều nghĩa gây
rối). Endpoint: `POST /api/lookup-context` (`web/backend/src/api/lookup-context.ts`). IPA + audio vẫn
lấy từ từ điển. *(Đây là điểm ĐẢO quyết định D-2 có kiểm soát — xem CLAUDE.md mục 4 / Blueprint.)*

**Cần gì để chạy trên production (đây là chỗ khách hay phải sửa):**
1. **Migration bảng cache** `..._ai_context_meaning` (bảng `ai_context_meaning`) — đã có sẵn; nếu dựng
   DB mới thì áp lại theo **mục 5**. Không có bảng → AI vẫn chạy nhưng KHÔNG cache (mỗi lần đều gọi OpenAI, tốn phí hơn).
2. **Đặt API key** ở **Vercel → project `studymovie-backend` → Settings → Environment Variables**:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** key OpenAI (dạng `sk-...`), lấy tại <https://platform.openai.com/api-keys>
     (cần tài khoản OpenAI + **nạp credit / gắn thẻ**).
   - **Environment:** Production.
   - → Sau khi lưu, **Redeploy** project backend (đổi env phải redeploy mới có hiệu lực).

**Chi phí:** `gpt-4o-mini` rất rẻ (~$0.15 / 1 triệu token input); mỗi cặp (từ + câu) chỉ gọi **1 lần**
rồi cache → thực tế rất thấp. Đặt hạn mức chi tiêu tại dashboard OpenAI (Billing → Limits) nếu muốn.

**Đổi / xoay key:** vào đúng chỗ trên (Vercel backend env) → sửa value `OPENAI_API_KEY` → **Redeploy**.

**Muốn TẮT tính năng (quay lại tra từ điển thuần):** chỉ cần **xoá biến `OPENAI_API_KEY`** ở backend →
Redeploy. Hệ thống **tự fallback** về từ điển (FVDP/Free Dictionary) — không lỗi, không phải sửa code.

**An toàn:** key CHỈ nằm ở backend (server-side), **không bao giờ** lộ ra extension/web.

---

## 4. Deploy

### 4.1 Frontend + Backend (Vercel)
- 2 project Vercel riêng (frontend / backend) để CORS độc lập.
- Nhập env mục 3.1 / 3.2 ở mỗi project → **Deploy**. Đổi env phải **Redeploy** mới có hiệu lực.
- Backend: `web/backend/api/index.ts` + `vercel.json` (rewrite `/(.*)` → `/api`).
  ⚠️ **KHÔNG gỡ** phần buffer `rawBody` trong `api/index.ts` — mọi POST trên Vercel phụ thuộc fix này.

### 4.2 Domain `app.studymovie.com`
1. Vercel project frontend → Settings → Domains → add `app.studymovie.com`.
2. DNS: thêm record `app` (CNAME → `cname.vercel-dns.com`, theo giá trị Vercel hiển thị).
3. Supabase → Authentication → URL Configuration: Site URL = `https://app.studymovie.com`;
   Redirect URLs thêm `https://app.studymovie.com/**` (giữ `http://localhost:3000/**` cho dev).
4. Google Cloud OAuth: Authorized JS origins thêm `https://app.studymovie.com`; Authorized redirect
   URI giữ `https://ojsdchkwfzhmzvmwlgmo.supabase.co/auth/v1/callback`.

### 4.3 Extension
- Dev (localhost): `cd extension && npm run build` → load unpacked `extension/dist`.
- Production (store): `cd extension && npm run build:prod` (đọc `extension/.env.production`) →
  bản prod tự bỏ localhost + version 1.0.0. Zip thư mục `extension/dist` để upload (xem mục 8).

---

## 5. Database (migrations)

- Nguồn tái tạo DB: `supabase/migrations/*.sql` (schema + RLS + RPC). Áp theo thứ tự tên file.
- Áp lên project: qua Supabase CLI (`supabase db push --linked`) hoặc chạy SQL trong dashboard.
- Danh sách hiện có: `..._init_schema`, `..._rpc`, `..._lookup_word_v2`, `..._payment_orders`,
  `..._streak_threshold`, `..._level_system`, `..._weekly_plans`, `..._access_status`, `..._admin`,
  `..._vocab_learned`, `..._dashboard_totals`, `..._ai_context_meaning` (cache nghĩa AI — mục 3.5),
  `..._leaderboard_period` (RPC `get_leaderboard(p_period)` cho bảng xếp hạng Tuần/Tháng/Toàn thời gian — mục 11).
- Seed từ điển EN-VI: `supabase/seed/import_dictionary.mjs` (nguồn **FVDP © Hồ Ngọc Đức, GPL v2 —
  GIỮ credit**). Verify RPC: `supabase/seed/verify_rpc.mjs`.
- Bootstrap admin: set `profiles.is_admin = true` cho email admin (qua SQL/dashboard).

---

## 6. Dev setup (máy mới)

```bash
cp .env.example .env      # điền giá trị thật
./init.sh                 # install + verify + health check (phải exit 0)
# chạy 3 khối:
cd web/backend  && npm run dev    # :8787
cd web/frontend && npm run dev    # :3000
cd extension    && npm run build  # rồi load unpacked extension/dist
```

## 7. Lệnh verify (CLAUDE.md mục 6)

```bash
cd web/frontend && npm run lint && npm run typecheck && npm run build
cd web/backend  && npm run lint && npm run typecheck && npm test
cd extension    && npm run lint && npm run build
# DB: supabase db reset --linked (hoặc quy trình migration)
```

---

## 8. Chrome Web Store — submission

**Tên:** StudyMovie — Học tiếng Anh qua YouTube

**Mô tả ngắn:** Học tiếng Anh qua YouTube với phụ đề song ngữ Anh–Việt và ôn từ vựng.

**Mô tả đầy đủ (tiếng Việt):**
> StudyMovie biến YouTube thành lớp học tiếng Anh. Tiện ích hiển thị phụ đề song ngữ Anh–Việt ngay
> trên trình phát, cho phép bấm vào từ để tra nghĩa, và lưu từ vựng để ôn tập trên web app
> (app.studymovie.com) bằng flashcard + bài kiểm tra. Theo dõi thời gian học, chuỗi ngày học và bảng
> xếp hạng để duy trì động lực. Dùng chung một tài khoản giữa tiện ích và web app.

- **Category:** Education
- **Ngôn ngữ:** Tiếng Việt
- **Privacy policy URL:** `https://app.studymovie.com/privacy` (trang vẫn LIVE, truy cập bằng URL trực tiếp. Footer web đã bỏ theo yêu cầu khách — TIP-049 — nên KHÔNG còn link privacy ở đáy trang; dán URL này thẳng vào ô Privacy policy của Store listing.)
- **Email liên hệ:** personalenglishcoachingvn@gmail.com

**Data usage (khai báo khi submit):**
- Thu thập: thông tin cá nhân (email), hoạt động học (thời gian học, từ vựng), thông tin xác thực.
- Mục đích: vận hành tính năng học + đồng bộ tài khoản. **Không bán** dữ liệu; không dùng cho mục đích
  ngoài dịch vụ.

**Giải trình quyền (permission justification):**

| Quyền | Lý do |
|---|---|
| `storage` | Lưu cài đặt phụ đề (chế độ/màu/cỡ chữ) và phiên đăng nhập cục bộ. |
| `tabs` | Mở web app (app.studymovie.com) từ popup. |
| host `*://*.youtube.com/*` | Chèn lớp phụ đề song ngữ vào trình phát YouTube (content script khai TĨNH trong manifest — KHÔNG cần quyền `scripting`, quyền đó chỉ cần khi gọi `chrome.scripting.*` lúc runtime; đã bị Chrome Web Store từ chối lần đầu vì khai thừa quyền không dùng tới, đã gỡ). |
| `alarms` | Ghi nhận/flush thời gian học định kỳ. |
| host `https://app.studymovie.com/*` | Đọc phiên đăng nhập của web app để đồng bộ tài khoản. |

**Các bước submit:**
1. Đăng ký Chrome Web Store Developer (phí một lần **$5**).
2. `cd extension && npm run build:prod` → zip toàn bộ thư mục `extension/dist`.
3. Dashboard → New item → upload file zip.
4. Điền mô tả, ảnh chụp màn hình, icon, category, ngôn ngữ.
5. Khai Privacy policy URL + Data usage + permission justification như trên.
6. Submit để Google review.

---

## 9. Checklist transfer ownership (Cách B)

- [ ] **GitHub:** transfer repo sang tài khoản khách (Settings → Transfer ownership).
- [ ] **Supabase:** transfer project sang org khách — **GIỮ region Singapore** (để không phải migrate data).
- [ ] **Vercel:** transfer cả 2 project (frontend + backend) sang team khách.
- [ ] **Google Cloud:** chuyển project OAuth (hoặc tạo mới) sang tài khoản khách.
- [ ] **XOAY toàn bộ key** (bắt buộc — key cũ agent/dev đã thấy):
  - [ ] Supabase: reset **anon key** + **service_role key** (Settings → API).
  - [ ] SePay: cấp lại `SEPAY_API_KEY`.
  - [ ] Google OAuth: tạo lại `GOOGLE_OAUTH_CLIENT_SECRET`.
  - [ ] OpenAI: dùng key OpenAI **của khách** cho `OPENAI_API_KEY` (thu hồi key dev cũ nếu có; đặt lại ở Vercel backend — mục 3.5).
- [ ] **Cập nhật lại env sau khi xoay key** ở: Vercel (frontend + backend), Supabase Auth (Google
  provider), `extension/.env.production` → rebuild `build:prod` + redeploy web.
- [ ] Đổi email liên hệ/admin sang của khách nếu cần.

---

## 10. Việc còn treo

- **`/blog`:** hiện `NEXT_PUBLIC_BLOG_URL=https://studymovie.com/blog`. Khi khách có URL blog thật →
  cập nhật biến này ở Vercel project frontend + redeploy. Đừng để trỏ nhầm về app.
- **Runtime verify domain mới:** sau khi `app.studymovie.com` live, chạy checklist tổng (login web →
  extension sync → thanh toán → paywall) trước khi coi migration domain là verified.

---

## 11. Cập nhật đợt feedback khách 02/07/2026

> Tài liệu tóm tắt cho KHÁCH: `BAN-GIAO-FEEDBACK-2026-07-02.md`. Mục này ghi các điểm KỸ THUẬT quan
> trọng cho người bảo trì. Toàn bộ 13 feedback + cải tiến đã DONE, verified, trên `main`.

### 11.1 Mô hình đăng nhập MỚI (quan trọng nhất)
- **Đăng nhập/đăng ký CHỈ ở Extension** (email/mật khẩu native + Google). Web KHÔNG còn form login —
  `app/page.tsx` chỉ hiện prompt "đăng nhập bằng tiện ích StudyMovie".
- Web nhận session từ extension qua **đồng bộ 2 chiều** (content script `auth-bridge` ↔ background):
  - **web→ext:** auth-bridge đọc `localStorage` web → gửi background (`SM_AUTH`). CHỈ gửi khi web CÓ
    session (không đè khi web trống).
  - **ext→web:** popup login → `SM_LOGIN` → background đọc session (`sm-ext-auth`) → `SM_SET_SESSION`
    ghi `localStorage` web (key `sb-<ref>-auth-token`) + reload. Web trống lúc mở → `SM_PULL_SESSION` kéo
    session ext. Chống loop reload bằng `sessionStorage['sm-synced']`.
  - **logout:** popup → `SM_LOGOUT` → background `chrome.tabs.query({})` báo mọi tab web dọn session + reload.
- **Google login (extension):** popup mở `app.studymovie.com/?login=google` → web tự chạy
  `signInWithOAuth(google)` → `/auth/callback` → session → đồng bộ về extension. (Google OAuth BẮT BUỘC
  redirect qua trang web — không làm native trong popup được.)
- **Web tự phục hồi token hỏng:** `lib/apiClient.ts` gặp **401** → `signOut({scope:'local'})` + về `/`
  (hết kẹt màn "invalid token").

### 11.2 Tính năng mới / thay đổi UI
- **Bảng xếp hạng 3 kỳ** Tuần/Tháng/Toàn thời gian — RPC `get_leaderboard(p_period)` (migration
  `..._leaderboard_period`, §5). Trang `/leaderboard` cũ (tuần) vẫn dùng `get_leaderboard_weekly` (giữ).
- **Popup extension** dựng lại theo Figma final: timer có **Tạm dừng/Tiếp tục** (state `accumulatedSec`
  ở background + serialize flush chống cộng đôi), card chế độ phụ đề, màn Đăng nhập/Đăng ký, màn "Hết hạn dùng thử".
- **Nghĩa từ AI** theo ngữ cảnh (§3.5). **Phụ đề Việt khớp Anh khi tua** (ghép EN↔VI theo độ chồng thời
  gian thay vì index — `extension/src/lib/captions.ts`).
- **Dashboard tự cập nhật** giờ học khi quay lại tab (refetch on visibility/focus).
- **ĐÃ GỠ:** dark mode (web luôn light), footer, avatar+menu góc phải web, form login web, Blog.
- **Link "Admin"** trên nav — chỉ hiện với tài khoản `is_admin` (Header.tsx, fail-closed).

### 11.3 Vận hành cần làm khi go-live
- **SePay webhook (thanh toán tự động) — LUỒNG VA (VPBank hộ kinh doanh):**
  - VPBank HKD liên kết SePay qua **tài khoản ảo (VA)** → tiền phải vào **VA** thì SePay mới đọc được.
  - SePay: bật **"cho phép sử dụng tài khoản phụ ngân hàng"** (`my.sepay.vn/company/configuration`);
    tạo webhook → URL `https://studymovie-backend.vercel.app/api/sepay-webhook`; **API Key** = biến
    `SEPAY_API_KEY` (phải TRÙNG 2 đầu); sự kiện **tiền vào**; xác thực thanh toán BẬT.
  - **QR:** backend sinh qua **`vietqr.app`** (KHÔNG dùng vietqr.io/qr.sepay.vn — 2 cái này KHÔNG payable
    với VA "AGBSP…"). Env backend: `BANK_ID=VPBank` (short name), `BANK_ACCOUNT_NO=AGBSP541966978` (VA),
    `VIETQR_TEMPLATE=compact`, `BANK_ACCOUNT_NAME=HO KINH DOANH LUC NAM TRUONG`. (Xem `buildVietQrUrl`
    trong `web/backend/src/api/payment.ts`.)
  - Backend đã có: đối soát mã đơn + số tiền + chống trùng giao dịch (idempotency) + cộng dồn hạn.
  - **Lưu ý:** một số app ngân hàng KHÔNG quét được VA ("account không tồn tại") = hạn chế phía app/nhà
    phát hành; app khác quét + CK bình thường → SePay đọc → tự kích hoạt Pro.
- **`OPENAI_API_KEY`** ở backend Vercel (§3.5) cho nghĩa từ AI.
- **Extension lên Store:** `npm run build:prod` + zip `extension/dist` (file `studymovie-extension-v1.0.0.zip`
  đã build lại đợt này, gồm mọi thay đổi). Xem §8.
- **Migration:** đảm bảo áp đủ, gồm `..._ai_context_meaning` (012) + `..._leaderboard_period` (013).

## 12. Cập nhật đợt feedback khách 04/07/2026

> Các điểm kỹ thuật đợt 04/07. Đều trên `main`, đã deploy production (frontend + backend + zip extension).

### 12.1 Tra từ (phiên âm + phát âm + tốc độ)
- **Lemmatize dạng gốc** để lấy phiên âm cho từ biến thể: số nhiều/-es/-ies, -ed, -ing, -ied
  (moments→moment, studies→study, carried→carry…). Backend `lookup.ts` `lemmaCandidates()` — thử vài
  ứng viên, chọn kết quả CÓ IPA. **Audio TTS fallback**: từ không có audio từ điển → dùng Google
  `translate_tts` → mọi từ có nút loa.
- **Popup tra từ render DẦN**: từ + phiên âm + loa hiện NGAY, nghĩa AI điền vào sau (không chờ AI mới
  hiện). Extension `content/youtube.ts` `onWordClick`.
- **Nút Phát âm** dùng **Web Speech API** (`speechSynthesis`, giọng en-GB của trình duyệt) — KHÔNG tải
  media ngoài nên không bị CSP của YouTube chặn → luôn ra tiếng. `youtube.ts` `speakWord/playPronunciation`.

### 12.2 Model AI đổi được qua ENV — CẬP NHẬT §3.5 (quan trọng cho bảo trì)
- Model nghĩa-theo-ngữ-cảnh giờ đọc từ env **`OPENAI_MODEL`** (Vercel backend). **Hiện đặt = `gpt-5-nano`**
  (rẻ hơn gpt-4o-mini). Đổi model = đổi env + redeploy, KHÔNG sửa code. Bỏ env → mặc định `gpt-4o-mini`.
- Code tự tương thích tham số: `gpt-5-*` dùng `max_completion_tokens` + `reasoning_effort:"minimal"`,
  KHÔNG gửi `temperature`; model khác dùng `temperature:0`. (`api/lookup-context.ts`)
- Prompt đã siết "đúng 1 nghĩa gọn, không liệt kê, không dấu '/'". **Lưu ý:** thực tế gpt-5-nano KHÔNG
  nhanh hơn 4o-mini rõ rệt (đều ~1–2s, phần lớn là latency OpenAI) — nano chỉ rẻ hơn. Muốn đổi lại:
  `OPENAI_MODEL=gpt-4o-mini` rồi redeploy.

### 12.3 Trang Từ vựng + Kiểm tra
- **`/tu-vung` tự cập nhật** sau khi lưu từ (qua extension) khi quay lại tab — refetch on visibility/focus
  (`app/tu-vung/page.tsx`).
- **Quiz chỉ hỏi từ đã chọn**: `buildQuiz(items, dir, askItems?)` — câu hỏi = danh sách đã chọn
  (`STUDY_SELECTION_KEY`); đáp án nhiễu (3 sai) vẫn lấy từ toàn kho (bình thường). `components/QuizGame.tsx`.

### 12.4 Flashcard — vuốt (swipe) + CHỖ KHÁCH CHỈNH ĐƯỢC
File `app/hoc-tu-vung/page.tsx` đã có chú thích "chỉnh được" ngay tại chỗ. Đổi thẻ bằng **vuốt**: kéo
phải → thẻ kế, kéo trái → thẻ trước, thẻ đầu/cuối → bật về, chạm nhẹ → lật xem ví dụ (đã bỏ nút mũi tên).

| Muốn đổi | Sửa ở (hoc-tu-vung/page.tsx) |
|---|---|
| Độ nhạy vuốt | `SWIPE_THRESHOLD` (số px kéo tối thiểu; tăng = phải kéo xa hơn) |
| Tốc độ hiệu ứng bay | `250` (ms) trong `commitSwipe` **VÀ** `.25s` trong `cardStyle` — đổi phải KHỚP nhau |
| Độ bay xa / độ nghiêng | `translateX(±130%)` / `rotate(±8deg)` trong nhánh `exit` của `cardStyle` (bỏ rotate = không nghiêng) |
| Chiều cao / bề rộng thẻ | `min-h-[260px]` / `max-w-xs` trong `renderCard` |

> "UI lỗi" khách nêu 04/07 đã tạm chỉnh (thẻ gọn 260px + căn giữa dọc). Nếu khách chỉ điểm khác thì
> chỉnh theo bảng trên.

### 12.5 Phụ đề Việt — 2 bug đã sửa + cache dùng chung (TIP-078) + phương án dịch trả phí (chưa làm)

**Bug 1 — phụ đề hiện SAI ngôn ngữ (không phải EN):** `yt-intercept.ts` coi request `timedtext` đầu
tiên KHÔNG có `tlang=` là track gốc "EN", nhưng KHÔNG kiểm tra `lang=` thật của request đó. Video có
track khác (vd tiếng Ả Rập) load trước EN (do preference tài khoản/kênh) → bị hiện nhầm làm "EN gốc".
Đã sửa: ép `lang=en` khi build `enUrl`, chỉ tái dùng body player khi request gốc ĐÚNG `lang=en`
(hàm `isEnglishLang`), khác thì bỏ qua và fetch lại đúng track EN.

**Bug 2 — popup extension kẹt "Đang tải…" mãi:** build dev (`npm run build`, không `--prod`) cần root
`.env` (KHÔNG tồn tại trong repo) → `SUPABASE_URL` bake rỗng → `createClient("")` throw ngay lúc
load → popup.js chết trước khi chạy dòng nào. **Luôn dùng `npm run build:prod`** (đọc
`extension/.env.production`) để build test/deploy thật. `build.mjs` giờ tự in cảnh báo rõ nếu lỡ
build dev mà thiếu `.env`.

**TIP-078 — Cache phụ đề Việt DÙNG CHUNG giữa mọi user (đã deploy):** Google (`timedtext&tlang=vi`)
thỉnh thoảng chặn anti-bot theo phiên trình duyệt cá nhân (hiện banner "⚠️ Phụ đề Việt tạm bị giới hạn").
Cơ chế mới: người xem đầu tiên của 1 video vẫn tự fetch VI từ trình duyệt như cũ (không đổi cách fetch,
không rủi ro thêm với anti-bot); fetch **thành công** thì gửi lên backend cache theo `video_id`. Người
xem SAU cùng video đọc thẳng cache — không gọi Google nữa. Video càng phổ biến (vd giáo viên giao cùng
1 link cho cả lớp qua "Kế hoạch tuần") càng ít khả năng bị chặn vì chỉ cần đúng 1 người "trả giá".
- DB: migration `vi_caption_cache` (bảng `video_id, vi jsonb, cue_count`; RLS bật, KHÔNG policy →
  chỉ backend service_role đọc/ghi được, client không truy cập trực tiếp).
- Backend: `GET/POST /api/captions-vi/:videoId` (`requireAuth + requireActive`) — `web/backend/src/api/captions.ts`.
- Extension: `yt-intercept.ts` (MAIN world, không có `chrome.runtime`) hỏi cache qua
  `window.postMessage({__sm:"SM_ASK_VI_CACHE"})` → `youtube.ts` (ISOLATED) relay qua `SM_API` proxy
  (background) → backend. Fetch Google thành công thì `contributeViCache()` gửi ngược lên cache.

**Phương án thay thế — dịch trả phí (chưa triển khai, cần khách xác nhận vì đảo quyết định kiến trúc
D-1 trong CLAUDE.md/Blueprint):** dùng OpenAI (đã có sẵn hạ tầng từ TIP-038, `OPENAI_API_KEY` +
`OPENAI_MODEL`) dịch nguyên câu phụ đề khi cache miss, thay vì gọi Google `tlang=vi`. Tận dụng nguyên
cache `vi_caption_cache` vừa xây — vẫn chỉ tốn phí **1 lần/video mới**, không tăng theo lượt xem. Ước
tính chi phí (giá tham khảo `gpt-4o-mini`, KIỂM TRA LẠI giá thật trước khi quyết — hay đổi):
- ~$0.002/video mới (video 10 phút ~150 dòng phụ đề, ~2.250 token input + ~3.000 token output).
- Quy mô: 100 video mới/tháng ≈ $0.2; 1.000 video mới/tháng ≈ $2; 10.000 video mới/tháng ≈ $20.
- Đổi lại: **không bao giờ bị chặn/giới hạn nữa** (bỏ hẳn banner "tạm bị giới hạn").
- Nếu làm: nhớ đặt **budget cap** trên OpenAI dashboard (Billing → Usage limits) — dùng chung 1
  tài khoản/dashboard với chi phí AI tra nghĩa từ (TIP-038) đã có, theo dõi tổng ở 1 chỗ.
