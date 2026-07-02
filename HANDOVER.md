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
  `..._vocab_learned`, `..._dashboard_totals`, `..._ai_context_meaning` (bảng cache nghĩa AI — cần cho
  tính năng nghĩa ngữ cảnh, mục 3.5).
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
- **Email liên hệ:** dkhiem2k4@gmail.com

**Data usage (khai báo khi submit):**
- Thu thập: thông tin cá nhân (email), hoạt động học (thời gian học, từ vựng), thông tin xác thực.
- Mục đích: vận hành tính năng học + đồng bộ tài khoản. **Không bán** dữ liệu; không dùng cho mục đích
  ngoài dịch vụ.

**Giải trình quyền (permission justification):**

| Quyền | Lý do |
|---|---|
| `storage` | Lưu cài đặt phụ đề (chế độ/màu/cỡ chữ) và phiên đăng nhập cục bộ. |
| `tabs` | Mở web app (app.studymovie.com) từ popup. |
| `scripting` + host `*://*.youtube.com/*` | Chèn lớp phụ đề song ngữ vào trình phát YouTube. |
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
