# StudyMovie — BLUEPRINT v1.4

> **Vai trò:** Chủ thầu (Contractor) · **Phương pháp:** Vibecode Kit v6.0 · **Bước:** 4/8 (BLUEPRINT & CONTRACT)
> **Trạng thái:** Đã chốt: xử lý tiếng Việt, repo monorepo, tách FE/BE, mô hình bàn giao, tooling. Chờ Human "APPROVED" trước khi sang Task Graph.
> **Thay đổi:** v1.1 — xử lý tiếng Việt. v1.2 — monorepo + tách FE/BE. v1.3 — mục 9 Handover & Ownership (Cách B). v1.4 — mục 11 Tooling (mượn gstack `/qa` + `/cso` + `/review` cho bước VERIFY, không thay quy trình Vibecode).

---

## 0. DECISIONS LOG — XỬ LÝ TIẾNG VIỆT (ĐÃ CHỐT)

Hai điểm P0 trước đây đã được chốt. Đây là nền tảng kiến trúc cho phần ngôn ngữ — **không đảo ngược nếu không re-confirm**.

| # | Vấn đề | Quyết định CHỐT | Cơ chế |
|---|--------|-----------------|--------|
| **D-1** | **Phụ đề tiếng Việt (cả câu) trên video** | Dùng **bản dịch tự động sẵn có của YouTube** (`tlang=vi`). KHÔNG tích hợp API dịch trả phí cho phần này. | Extension gọi endpoint `timedtext` của YouTube với `tlang=vi` để lấy dòng VI đã dịch. Đây là machine translation của chính YouTube (Google Translate dưới hood). |
| **D-2** | **Nghĩa của từ khi user click để lưu vào vocab** | Dùng **từ điển Anh-Việt mã nguồn mở nhúng sẵn** (tra cứu — *dictionary lookup*, KHÔNG phải dịch máy). | Mỗi lần click 1 từ → chuẩn hóa về dạng gốc (lemmatize) → tra trong DB từ điển → trả nghĩa + IPA + ví dụ. Tra **từng từ một**, không dịch cả câu, không ghép word-by-word. |

**Hệ quả chi phí:** chi phí vận hành cho toàn bộ phần ngôn ngữ ≈ **$0** (YouTube tự dịch miễn phí + từ điển offline). Bỏ hoàn toàn nhu cầu Google Translate / MyMemory trả phí đã cân nhắc ở v1.0.

**Phân biệt 3 cơ chế (để Thợ không nhầm):**
- *Dịch cả câu* (YouTube `tlang`) → dùng cho **dòng phụ đề** hiển thị trên video.
- *Tra từ điển từng từ* (lookup) → dùng cho **nghĩa từ vựng** khi click.
- *Dịch word-by-word rồi ghép câu* → **KHÔNG dùng** (cho ra câu sai ngữ pháp).

**Ràng buộc đã biết — phải ghi vào Contract / báo khách:**
1. **`tlang` chỉ dịch được khi video có caption gốc** (manual hoặc auto-ASR). Video không bật phụ đề → không có dòng VI. Đây là giới hạn từ YouTube, không phải lỗi sản phẩm.
2. **Endpoint `timedtext` là API không chính thức** của YouTube → rủi ro **bảo trì**: YouTube có thể đổi backend/áp rate limit (HTTP 429). Gọi từ client (IP từng user) giúp phân tán rate limit. Cần fallback khi fail.
3. **Nguồn từ điển thực tế = FVDP (GPL v2)** → phải **ghi credit + license + link nguồn** trong app (trang About/Settings). GPL không cấm dùng thương mại; giữ data tách biệt trong DB (không nhúng vào source) để giảm rủi ro copyleft. **Báo khách rõ về license GPL khi bàn giao.**

**Nguồn từ điển (ĐÃ DÙNG ở TIP-002):**
- **Free Vietnamese Dictionary Project (FVDP), © Hồ Ngọc Đức** — EN-VI, 103.401 mục, license **GNU GPL v2**. Lấy qua mirror GitHub (`manhminno/English-Vietnamese-Dictionary`). Đã import full vào bảng `dictionary`.
- License GPL v2: được dùng thương mại + phân phối lại; phải kèm credit + license + nguồn. Data tách biệt trong DB (không nhúng source) → rủi ro copyleft thấp.
- (Nguồn ưu tiên ban đầu `minhqnd/dictionary` SQLite — repo rỗng, không dùng được.)

---

## 1. TỔNG QUAN KIẾN TRÚC

Sản phẩm = **3 khối** dùng chung 1 tài khoản Google + 1 database.

```
                       ┌─────────────────────────┐
                       │   Google OAuth (chung)   │
                       └────────────┬─────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌──────────────────┐      ┌──────────────────┐        ┌──────────────────┐
│ CHROME EXTENSION │      │   WEB FRONTEND    │        │   BACKEND API     │
│  (Manifest V3)   │      │   (Next.js 15)    │        │ (Next.js/Hono)    │
│                  │      │  studymovie.com   │        │  dùng chung cho   │
│ • Dual subtitle  │      │ • Dashboard       │        │  web + extension  │
│ • Click→tra/lưu  │      │ • Vocabulary      │        │ • services        │
│ • Timer session  │      │ • Flashcard/Quiz  │        │ • repositories    │
│ • Settings popup │      │ • Playlist tuần   │        │ • integrations    │
│ • Trial check    │      │ • Leaderboard     │        │   (sepay/vietqr/  │
│                  │      │ • Upgrade(VietQR) │        │    dictionary)    │
│                  │      │ • Settings        │        └────────┬─────────┘
└────────┬─────────┘      └─────────┬─────────┘                 │
         │                          │                           ▼
         └────────► BACKEND API ◄───┘                  ┌──────────────────┐
              (cả 2 client gọi chung)                  │   SUPABASE (DB)   │
                                                       │ Postgres+Auth+RLS │
                                                       │ profiles/vocab/   │
                                                       │ sessions/dict...  │
                                                       └──────────────────┘
```

**Nguyên tắc kiến trúc chốt:**
1. **Backend API là tầng giữa dùng chung.** Cả web frontend và extension đều gọi `web/backend` (kèm JWT user); backend chứa nghiệp vụ + nói chuyện với Supabase. Client không gọi thẳng DB cho các thao tác nghiệp vụ. Backend là single source of truth.
2. **Auth dùng chung 1 Supabase project.** Extension login Google → lấy session token Supabase → gọi API như web. Không tự xây auth riêng cho extension.
3. **Leaderboard + streak = compute-on-read.** KHÔNG cron reset (đã có bài học pg_cron/Vercel Hobby cron cap 1/day ở dự án trước). "Reset thứ 2 hàng tuần" = query lọc `study_sessions` theo tuần ISO hiện tại, không xoá dữ liệu.
4. **Trial/subscription check ở backend.** Extension hỏi backend "còn hạn không", không tự tính client-side (tránh user chỉnh giờ máy để gian lận).

---

## 2. TECH STACK

| Khối | Công nghệ | Lý do |
|------|-----------|-------|
| Chrome Extension | **Manifest V3**, content script + popup. UI popup bằng vanilla JS hoặc Preact (nhẹ). | Brief yêu cầu MV3. Content script để inject subtitle vào YouTube DOM. |
| Web Frontend | **Next.js 15 (App Router) + React 19 + Tailwind** | Chỉ UI, gọi backend qua API. Deploy Vercel. |
| Backend API | **Next.js (API-only) hoặc Hono** trên Vercel, deploy riêng | Tầng API dùng chung cho web frontend + extension; chứa nghiệp vụ, gọi Supabase. |
| Database | **Supabase** (Postgres + Auth + RLS) | Auth Google sẵn, RLS bảo mật theo user. Rẻ, deploy nhanh. |
| Auth | **Supabase Auth — Google OAuth provider** | Chung 1 tài khoản cho cả extension + web (brief yêu cầu). |
| Phụ đề VI (cả câu) | **YouTube auto-translate** (`timedtext` + `tlang=vi`) | Dịch sẵn, miễn phí, gọi từ client. Phụ thuộc video có caption gốc + endpoint không chính thức (rủi ro bảo trì). |
| Nghĩa từ + IPA + ví dụ | **Từ điển EN-VI nhúng — FVDP © Hồ Ngọc Đức** (import vào bảng `dictionary`, 103k mục) | Tra cứu offline, $0, ổn định. License **GPL v2** → ghi credit + nguồn trong app. |
| Audio phát âm | **Free Dictionary API** (`api.dictionaryapi.dev`) | Miễn phí, file audio + IPA tiếng Anh. Bổ sung nếu từ điển nhúng thiếu audio. |
| Thanh toán | **VietQR (generate QR động) + SePay webhook** | Brief yêu cầu. Tự động unlock khi nhận tiền. |
| Hosting | Web App → **Vercel**; Extension → **Chrome Web Store** | Brief yêu cầu. |

> **Lưu ý nghĩa từ — KHÔNG dịch máy:** nghĩa từ vựng là *tra từ điển* (lookup), không phải dịch. Trước khi tra phải **lemmatize** (đưa "running"→"run", "studies"→"study", "went"→"go") nếu không sẽ "không tìm thấy". Một từ trả về nhiều nghĩa là bình thường và tốt cho học tập — câu phụ đề lưu kèm làm ngữ cảnh để user biết nghĩa nào đúng.

> **Lưu ý MV3:** Manifest V3 dùng service worker (không persistent), không có `localStorage` kiểu cũ trong content script context — dùng `chrome.storage`. Trial timer/session phải resilient với service worker bị kill: ghi mốc `started_at` xuống storage/DB, tính duration theo timestamp chứ không đếm interval trong JS.

---

## 3. DATA MODEL (Supabase / Postgres)

Tất cả bảng có RLS: user chỉ đọc/ghi dữ liệu của chính mình (trừ leaderboard đọc public qua RPC `SECURITY DEFINER`).

```sql
-- profiles: hồ sơ user (1-1 với auth.users)
profiles (
  id            uuid PK REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text,
  nickname      text,                 -- hiển thị trên leaderboard
  avatar_url    text,
  daily_commit_minutes int DEFAULT 30,-- user tự set ở Settings
  created_at    timestamptz DEFAULT now()
)

-- subscriptions: trạng thái trial/trả phí
subscriptions (
  user_id       uuid PK REFERENCES profiles(id) ON DELETE CASCADE,
  status        text CHECK (status IN ('trial','active','expired')),
  trial_ends_at timestamptz,          -- = created_at + 24h
  paid_until    timestamptz,          -- NULL nếu chưa trả
  created_at    timestamptz DEFAULT now()
)

-- vocabulary: từ đã lưu từ extension
vocabulary (
  id            uuid PK DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE,
  word          text NOT NULL,        -- từ tiếng Anh (dạng user click)
  lemma         text,                 -- dạng gốc đã chuẩn hóa để tra từ điển
  ipa           text,                 -- phiên âm (từ từ điển nhúng)
  meaning_vi    text,                 -- nghĩa VI (copy từ từ điển nhúng lúc lưu)
  example       text,                 -- câu subtitle đang hiện lúc lưu (ngữ cảnh)
  audio_url     text,                 -- từ Free Dictionary API (cache)
  created_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, word)               -- tránh lưu trùng
)

-- dictionary: từ điển EN-VI nhúng (import 1 lần từ minhqnd/dictionary SQLite)
-- KHÔNG có RLS riêng theo user — đây là dữ liệu tra cứu dùng chung, đọc public.
dictionary (
  lemma         text PRIMARY KEY,     -- từ gốc tiếng Anh
  ipa           text,
  meanings      jsonb,                -- mảng nghĩa VI + từ loại + ví dụ
  audio_url     text
)

-- study_sessions: mỗi lần Start→Stop = 1 record (nguồn của dashboard + leaderboard + streak)
study_sessions (
  id            uuid PK DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL,
  ended_at      timestamptz NOT NULL,
  duration_sec  int NOT NULL,         -- ended_at - started_at (tính server-side)
  created_at    timestamptz DEFAULT now()
)

-- playlist_items: video YouTube cho tuần (todo list)
playlist_items (
  id            uuid PK DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE,
  youtube_url   text NOT NULL,
  video_id      text,                 -- extract từ URL
  title         text,
  thumbnail_url text,
  is_done       bool DEFAULT false,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
)

-- LƯU Ý: KHÔNG cần bảng cache dịch phụ đề. Phụ đề VI lấy trực tiếp từ
-- YouTube (tlang=vi) phía client, YouTube đã tự cache/dịch. Bỏ sub_cache của v1.0.
```

**RPC quan trọng (SECURITY DEFINER, có guard):**
- `get_leaderboard_weekly()` → top users theo `SUM(duration_sec)` trong tuần ISO hiện tại, join `profiles` (nickname + avatar). Luôn append dòng của caller dù không trong top.
- `get_dashboard()` → dùng `auth.uid()` (KHÔNG nhận tham số user_id — tránh giả mạo xem dashboard người khác). Trả streak (Duolingo, UTC+7) + cờ `today_met` + phút hôm nay + mảng giờ học tuần/tháng.
- `today_minutes(user_id)` → phút đã học hôm nay (extension gọi để hiển thị).
- `lookup_word(p_word)` → nhận từ user click, lemmatize, tra bảng `dictionary`, trả nghĩa + IPA + ví dụ. Đọc public (không cần là dữ liệu của user).

**Logic streak (CHỐT — chuẩn Duolingo, Thợ không được đoán khác):**
- "Ngày" tính theo timezone **Asia/Ho_Chi_Minh (UTC+7)** cho toàn hệ thống (không per-user).
- Một ngày "đạt" = tổng `duration_sec` trong ngày đó ≥ `daily_commit_minutes × 60`.
- **Streak = số ngày liên tiếp đã đạt, tính tới hôm qua.** Hôm nay đạt → streak +1 ngay lúc đạt.
- **Hôm nay CHƯA đạt → streak giữ nguyên con số** (không +1, không reset). Hiển thị kèm nhãn/biểu tượng "chưa đạt hôm nay" (vd ngọn lửa xám), đạt rồi thì sáng lên.
- **Reset về 0 chỉ khi một ngày trôi qua hoàn toàn mà không đạt** (sang ngày mới, ngày trước đó bị bỏ lỡ).

---

## 4. PHÂN RÃ MODULE + REQUIREMENTS MATRIX

### Extension (EXT)

| REQ-ID | Tính năng | Ghi chú kỹ thuật |
|--------|-----------|------------------|
| EXT-01 | Dual subtitle EN trên / VI dưới, ẩn sub gốc YouTube | Lấy caption EN + caption VI (`timedtext` với `tlang=vi`) gọi từ client; overlay lên player, đồng bộ theo `currentTime`. Fallback khi video không có caption gốc → chỉ hiện dòng EN (không vỡ). |
| EXT-02 | Click từ → popup: từ, IPA, 🔊, nghĩa VI, nút Lưu | Click 1 từ → lemmatize → gọi `lookup_word` (từ điển nhúng) lấy nghĩa VI + IPA + ví dụ; audio ← Free Dictionary API. Lưu kèm câu sub đang hiện làm ngữ cảnh. **Tra từng từ, KHÔNG dịch câu.** |
| EXT-03 | Timer Start/Pause/Stop, hiển thị phút học hôm nay | Stop → tạo `study_sessions`. Tính duration server-side theo timestamp. |
| EXT-04 | Popup Settings: bật/tắt sub, chế độ hiển thị (EN+VI/EN/VI/tắt), font size ±, màu chữ, bật/tắt background | Lưu vào `chrome.storage`. |
| EXT-05 | Hiển thị avatar + tên user đang đăng nhập | Từ profile. |
| EXT-06 | Login Google lần đầu, trial 24h | Sau login tạo `subscriptions` status=trial, `trial_ends_at = now()+24h`. |
| EXT-07 | Mỗi lần vào YouTube check hạn; hết hạn → ẩn sub + thông báo + nút "Nâng cấp" → `studymovie.com/upgrade` | Check ở backend, không client-side. |

### Web App (WEB)

| REQ-ID | Trang | Tính năng |
|--------|-------|-----------|
| WEB-01 | `/` login | Google OAuth, chung tài khoản với extension. |
| WEB-02 | `/tien-do-hoc` | Streak, đồ thị giờ học tuần/tháng, "hôm nay X/Y phút" + progress bar. |
| WEB-03 | `/vocabulary` (list) | Toàn bộ từ đã lưu (word/IPA/nghĩa/example/🔊), **xóa** từng từ; nút Flashcard / Quiz EN→VI / Quiz VI→EN — **học TẤT CẢ từ, không tick chọn**. |
| WEB-04 | `/vocabulary` (flashcard) | Thẻ: từ + IPA + nghĩa + 🔊, swipe trái/phải (ref UI: langswipe). |
| WEB-05 | `/vocabulary` (quiz) | 1 từ + 4 đáp án (3 sai random từ vocab của chính user), 2 chiều EN→VI và VI→EN. |
| WEB-06 | `/playlist` | Paste link YouTube, todo list (thumbnail+tên), nút Học (mở tab + auto-start timer extension), tick done, xóa từng video. |
| WEB-07 | `/leaderboard` | Top users theo tổng giờ tuần (reset thứ 2 = compute-on-read), avatar+nickname+tổng giờ, 🥇🥈🥉, user hiện tại pin ở cuối. |
| WEB-08 | `/upgrade` | VietQR động theo user (nội dung CK điền sẵn), text info + nút copy, auto unlock qua SePay webhook. |
| WEB-09 | `/settings` | Đổi nickname, set phút cam kết/ngày, xem hạn subscription, đăng xuất. |

### Backend / Integration (BE)

| REQ-ID | Hạng mục |
|--------|----------|
| BE-01 | Supabase Auth Google + bảng `profiles` auto-create khi đăng ký |
| BE-02 | Toàn bộ schema + RLS (mục 3) |
| BE-03 | RPC: leaderboard, dashboard, today_minutes, streak, `lookup_word` |
| BE-04 | API `/api/sepay-webhook`: verify → match nội dung CK → cập nhật `subscriptions.paid_until`, status=active |
| BE-05 | API generate VietQR động theo user (mã định danh trong nội dung CK) |
| BE-06 | Import từ điển EN-VI (SQLite `minhqnd/dictionary`) vào bảng `dictionary` + thư viện lemmatize cho `lookup_word`. Ghi credit nguồn trong app. |

> **Bảo mật chốt:** secret nhạy cảm (SePay webhook secret, service-role key) **không bao giờ** nằm trong extension hay client web — chỉ đi qua serverless route. Extension chỉ cầm JWT user. (Phần dịch không còn dùng API key trả phí nên không có key dịch để lo.)

---

## 5. USER FLOWS

**Flow 1 — Onboarding & Trial**
Cài extension → bấm icon → "Đăng nhập Google" → OAuth → backend tạo profile + subscription(trial, +24h) → extension chạy bình thường trên YouTube.

**Flow 2 — Học trên YouTube (extension)**
Mở video → extension check hạn (còn) → hiện dual subtitle → user bấm Start timer → click từ lạ → popup nghĩa/IPA/audio → Lưu (ghi `vocabulary`) → xem xong bấm Stop → ghi `study_sessions`.

**Flow 3 — Ôn tập (web)**
Vào `studymovie.com` → dashboard xem streak/giờ → `/vocabulary` (xem/xóa từ) → Flashcard / Quiz 2 chiều (học tất cả từ) → `/playlist` quản lý video tuần → `/leaderboard` xem thứ hạng.

**Flow 4 — Hết trial → Thanh toán**
Vào YouTube sau 24h → extension check (hết hạn) → ẩn sub + nút Nâng cấp → `/upgrade` → quét VietQR (nội dung CK có mã user) → chuyển khoản → SePay webhook bắn về `/api/sepay-webhook` → match mã → `paid_until` cập nhật → lần check kế tiếp extension chạy lại.

---

## 6. FILE STRUCTURE (đề xuất)

**Quản lý mã nguồn: 1 repo GitHub duy nhất (monorepo).** Cả 3 phần (extension/web/supabase) chung 1 repo vì liên quan chặt + dùng chung 1 DB → dễ phát triển và bàn giao 1 lần. Thư mục `web/` **tách rõ `frontend/` (UI) và `backend/` (API)** theo yêu cầu khách — backend là service dùng chung cho cả web frontend lẫn extension. Việc khởi tạo repo thuộc TIP-001 (Scaffold).

```
studymovie/
├── extension/                    # Chrome Extension (MV3)
│   ├── manifest.json
│   ├── content/
│   │   ├── subtitle.js           # EXT-01: inject dual subtitle
│   │   ├── wordPopup.js          # EXT-02: click từ → popup
│   │   └── sync.js               # đồng bộ timedtext theo currentTime
│   ├── popup/
│   │   ├── popup.html/js         # EXT-03 timer, EXT-05 user, EXT-07 trial banner
│   │   └── settings.js           # EXT-04
│   ├── background/
│   │   └── service-worker.js     # auth session, trial check, message routing
│   └── lib/
│       ├── api.js                # gọi Supabase/serverless (kèm JWT)
│       └── storage.js            # chrome.storage helpers
│
├── web/
│   ├── frontend/                 # Next.js 15 (App Router) — CHỈ UI, gọi backend qua API
│   │   ├── app/
│   │   │   ├── page.tsx          # WEB-01 login
│   │   │   ├── dashboard/        # WEB-02
│   │   │   ├── vocabulary/       # WEB-03/04/05 list + flashcard + quiz
│   │   │   ├── playlist/         # WEB-06
│   │   │   ├── leaderboard/      # WEB-07
│   │   │   ├── upgrade/          # WEB-08
│   │   │   └── settings/         # WEB-09
│   │   ├── components/           # Flashcard, QuizCard, StreakChart, LeaderRow...
│   │   ├── hooks/
│   │   └── lib/
│   │       ├── supabaseClient.ts # auth phía client
│   │       └── apiClient.ts      # gọi web/backend (kèm JWT)
│   │
│   └── backend/                  # API service — DÙNG CHUNG cho web frontend + extension
│       ├── api/                  # route handlers (mỏng)
│       │   ├── sepay-webhook     # BE-04
│       │   ├── vietqr            # BE-05
│       │   ├── lookup-word       # tra từ điển (EXT-02 + flashcard web)
│       │   ├── sessions          # ghi study_sessions, today_minutes
│       │   ├── vocabulary        # CRUD từ vựng
│       │   └── subscription      # check trial/hạn (EXT-07)
│       ├── services/             # nghiệp vụ: subscription, leaderboard, payment, streak
│       ├── repositories/         # truy cập Supabase / gọi RPC
│       └── integrations/         # sepay, vietqr, freedictionary, import từ điển
│
└── supabase/
    ├── migrations/               # schema + RLS + RPC (mục 3)
    └── seed/
        └── import_dictionary.ts  # BE-06: import minhqnd SQLite → bảng dictionary
```

---

## 7. TASK GRAPH PREVIEW (bản đồ TIP)

Bám theo 5 giai đoạn bạn đã chào khách, nhưng chia nhỏ thành TIP có thể giao cho Thợ. **Web App làm trước Extension** (đúng đề xuất của bạn — extension ghi dữ liệu *vào* nền tảng nên backend + web phải có trước).

```
GĐ0  TIP-000  PoC dual-subtitle YouTube tlang=vi (1 video) + PoC VietQR/SePay sandbox
                       │
GĐ1  TIP-001  Scaffold: monorepo (web/frontend + web/backend tách riêng), Supabase project, Google OAuth
        │
        ▼
     TIP-002  Data layer: toàn bộ schema + RLS + seed + import từ điển EN-VI (mục 3, BE-06)
        │
        ├──► TIP-003  RPC core: dashboard/streak/leaderboard/today_minutes/lookup_word
        │
        ▼
     TIP-004  Web /vocabulary: list + flashcard (swipe) + quiz 2 chiều
        │
        ▼
     TIP-005  Web /tien-do-hoc (streak+đồ thị) + /settings + /leaderboard
        │
        ▼
     TIP-006  Web /playlist (todo + thumbnail + tick + nút Học)
                       │
GĐ2  TIP-007  Extension scaffold MV3 + auth session dùng chung + trial check (EXT-05/06/07)
        │
        ▼
     TIP-008  Extension dual subtitle + ẩn sub gốc (EXT-01) — phụ thuộc kết quả PoC TIP-000
        │
        ▼
     TIP-009  Extension click từ → popup tra/lưu (EXT-02) + Settings popup (EXT-04)
        │
        ▼
     TIP-010  Extension timer Start/Pause/Stop → study_sessions (EXT-03)
        │       + tích hợp nút "Học" từ playlist auto-start (nối WEB-06)
        │
GĐ3  TIP-011  /upgrade: VietQR động (BE-05) + trang thanh toán (WEB-08)
        │
        ▼
     TIP-012  SePay webhook auto-unlock (BE-04) — end-to-end test sandbox
                       │
GĐ4  TIP-013  QA Tier 1+2 (RRI-T) + gstack /qa (browser thật) + /cso security audit, sửa lỗi
        │
        ▼
     TIP-014  Đóng gói extension (Chrome Web Store) + deploy frontend/backend Vercel + transfer ownership (mục 9)
        │
        ▼
     TIP-015  VERIFY (RRI Reverse) + nghiệm thu
```

Mỗi TIP khi tạo sẽ có đủ: Gherkin acceptance criteria, priority P0/P1/P2, context/file, constraints, Completion Report format.

---

## 8. SCOPE & CONTRACT

### ✅ TRONG phạm vi (IN SCOPE)
- Chrome Extension MV3 chạy **YouTube** (đầy đủ EXT-01 → EXT-07).
- Web App Next.js đầy đủ 9 trang (WEB-01 → WEB-09).
- Backend Supabase: schema + RLS + RPC + auth Google chung.
- Phụ đề VI: dùng YouTube auto-translate (`tlang=vi`).
- Nghĩa từ: tích hợp từ điển EN-VI mã nguồn mở (nhúng) + lemmatize; audio/IPA từ Free Dictionary API.
- VietQR động + SePay webhook auto-unlock.
- Bàn giao **1 repo GitHub** (extension + web + supabase migrations) + hướng dẫn deploy Vercel + submit Chrome Web Store.

### ❌ NGOÀI phạm vi (OUT OF SCOPE)
- **Netflix** (khách đã bỏ).
- App mobile native (chỉ extension + web).
- Nội dung khoá học / từ điển tự biên soạn (chỉ dùng nguồn mã nguồn mở).
- Dịch nghĩa "đúng theo ngữ cảnh câu" bằng AI (từ điển trả nhiều nghĩa là chuẩn cho học từ).
- Khắc phục khi video không có caption gốc (giới hạn từ YouTube).
- Phí Chrome Web Store developer ($5) + chi phí domain/hosting (khách tự lo, trừ khi thỏa thuận khác).

### 📦 Khách cung cấp
- Figma đầy đủ UI.
- Tài khoản/thông tin: Google OAuth credentials, tài khoản ngân hàng + SePay, domain `studymovie.com`.

---

## 9. HANDOVER & OWNERSHIP (Cách B — chuyển quyền ở milestone cuối)

**Mô hình:** Dev trên tài khoản của bên thực hiện (GitHub + Supabase + Vercel + Google Cloud). Toàn bộ quyền sở hữu chuyển cho khách ở **milestone cuối, sau khi thanh toán đủ**. Lựa chọn này giữ quyền kiểm soát tới khi nghiệm thu + thanh toán xong; đổi lại cần một bước transfer ở GĐ4.

**Nền tảng giúp transfer dễ:** DB định nghĩa 100% bằng migration trong `supabase/migrations/` (TIP-002) → khách tái tạo DB y hệt từ code, không lệ thuộc thao tác transfer thủ công. Chỉ data thật của user (nếu có lúc bàn giao) mới cần backup/restore — mà thời điểm bàn giao thường chưa có user thật.

**Quy trình chuyển giao (thực hiện ở GĐ4):**

*GitHub:* repo → Settings → Transfer ownership → chuyển sang tài khoản/org khách. Giữ nguyên toàn bộ lịch sử commit + branch.

*Supabase (chọn 1 trong 2):*
- **Mời nhau vào chung org:** khách mời mình vào org khách (hoặc ngược lại) → General settings của project → Transfer project → nhường quyền owner. ⚠️ KHÔNG chuyển được giữa region khác nhau → chọn **region gần VN (Singapore)** ngay từ đầu; nếu org đích là Free plan, kiểm tra giới hạn 2 project free trước.
- **Tách biệt hoàn toàn:** khách tạo project mới → chạy migration từ repo để dựng schema → (nếu cần) backup/restore data qua Supabase CLI.

*Vercel:* chuyển 2 project (frontend + backend) sang tài khoản khách, hoặc khách tạo mới rồi deploy từ repo + cấu hình lại env.

**Thay toàn bộ key sang của khách (bắt buộc lúc bàn giao):**
- Google OAuth client ID + secret (tạo lại trên Google Cloud của khách)
- SePay credentials + webhook secret
- Supabase URL + anon key + service-role key
- Biến môi trường trên cả 2 Vercel project (frontend + backend)
- Domain `studymovie.com` (DNS trỏ Vercel)

**Trong repo phải có sẵn (chuẩn bị từ sớm, không để cuối):**
- `.env.example` đầy đủ tên biến (không giá trị thật).
- `HANDOVER.md`: cách lấy từng key, chạy migration, deploy frontend/backend, submit Chrome Web Store.

**Liên kết thanh toán:** transfer ownership = bước cuối cùng, thực hiện **sau khi khách thanh toán milestone cuối**. Trước đó, bản preview/demo chạy trên hạ tầng của bên thực hiện để khách nghiệm thu.

**Checklist bàn giao (Definition of Done cho handover):**
- [ ] Transfer GitHub repo sang khách
- [ ] Transfer / tái tạo Supabase project (migration chạy sạch trên project của khách)
- [ ] Transfer / deploy lại 2 Vercel project
- [ ] Toàn bộ key đã đổi sang của khách; app chạy được hoàn toàn trên hạ tầng khách
- [ ] `.env.example` + `HANDOVER.md` đầy đủ trong repo
- [ ] Extension submit Chrome Web Store dưới tài khoản developer của khách
- [ ] Khách xác nhận nghiệm thu

---

## 10. RỦI RO & QUYẾT ĐỊNH KIẾN TRÚC CHỐT

| Rủi ro | Mức | Xử lý |
|--------|-----|-------|
| Video không có caption gốc → không có dòng VI | 🟡 TB | Giới hạn từ YouTube. Fallback chỉ hiện EN (không vỡ UI). Báo khách trước (đã ghi Decisions Log). |
| Endpoint `timedtext` không chính thức → YouTube đổi/rate-limit (429) | 🟡 TB | Gọi từ client (IP từng user, phân tán). Viết phòng thủ + fallback. Flag rủi ro bảo trì sau bàn giao. |
| Từ điển nhúng thiếu từ / sai dạng (chưa lemmatize) | 🟡 TB | Bước lemmatize bắt buộc trước khi tra; nếu vẫn miss → hiện "chưa có nghĩa", cho user lưu kèm câu ngữ cảnh. |
| YouTube đổi DOM → vỡ subtitle injection | 🟡 TB | Ưu tiên `timedtext` thay vì scrape DOM player; selector phòng thủ; flag bảo trì. |
| MV3 service worker bị kill giữa session | 🟡 TB | Timer tính theo timestamp (`started_at` lưu storage/DB), không đếm interval. |
| Leaderboard/streak "reset hàng tuần" hiểu nhầm thành xoá data | 🟡 TB | Chốt: compute-on-read theo tuần ISO, **không** cron, **không** xoá. |
| Giấy phép từ điển FVDP là **GPL v2** (copyleft) | 🟡 TB | Data tách biệt trong DB (không nhúng source); ghi credit + license + nguồn trong app; báo khách rõ. Cân nhắc đổi nguồn license dễ hơn nếu khách yêu cầu đóng nguồn tuyệt đối. |
| Transfer ownership lúc bàn giao (Cách B) phức tạp / sót key | 🟡 TB | DB định nghĩa bằng migration; chuẩn bị `.env.example` + `HANDOVER.md` sớm; chọn region Singapore từ đầu (mục 9). |
| Gian lận trial bằng chỉnh giờ máy | 🟢 Thấp | Check hạn ở backend theo `now()` server. |
| Chrome Web Store review reject | 🟢 Thấp | Manifest đúng chuẩn, mô tả quyền rõ; hỗ trợ submit ở GĐ4. |

**Quyết định không đảo ngược (không sửa nếu không re-confirm):**
1. Backend là source of truth, extension không có DB riêng.
2. 1 Supabase project + Google OAuth chung cho cả extension và web.
3. Leaderboard + streak compute-on-read, không cron.
4. Trial/subscription check server-side.
5. Secret nhạy cảm đi qua serverless, không nằm ở client.
6. Web App build trước Extension.
7. **Phụ đề câu = YouTube `tlang=vi`** (không dịch trả phí).
8. **Nghĩa từ = từ điển EN-VI nhúng, tra cứu từng từ** (không dịch máy, không ghép word-by-word).
9. **Mã nguồn = 1 repo GitHub monorepo** (extension/ + web/ + supabase/ chung 1 repo).
10. **`web/` tách `frontend/` (UI) + `backend/` (API)**; backend là service dùng chung cho web frontend + extension, deploy riêng.
11. **Bàn giao theo Cách B:** dev trên hạ tầng bên thực hiện, transfer toàn bộ (GitHub + Supabase + Vercel + keys) cho khách ở milestone cuối sau thanh toán. Chọn Supabase region Singapore từ đầu (không transfer được cross-region).

---

## 11. TOOLING — gstack (công cụ bổ trợ, KHÔNG thay quy trình)

**Nguyên tắc:** Vibecode Kit v6.0 là xương sống quy trình. gstack chỉ dùng như **công cụ điểm** ở bước VERIFY / QA / Security — **KHÔNG** bật tầng process của gstack (`/office-hours`, `/plan-*-review`, `/autoplan`) vì trùng với SCAN / RRI / BLUEPRINT / TIP, sẽ gây double-process và rối cho Thợ.

**Cài đặt & ràng buộc:**
- Cài **global trên máy** người thực hiện. **KHÔNG `team-init` vào repo StudyMovie** — tránh để `.claude/` + section CLAUDE.md của gstack lọt vào repo, giữ repo bàn giao sạch cho khách (Cách B, mục 9).
- **Windows:** chạy trong **WSL2** (Bun có bug Playwright pipe transport trên Windows).
- **MIT license** — dùng được cho dự án freelance thương mại, không vướng.

**Map skill → vai trò → dùng ở đâu:**

| gstack skill | Vai trò | Dùng ở |
|---|---|---|
| `/qa` | Mở browser thật, click qua flow, tìm + fix bug, tự sinh regression test | **TIP-013 (QA Tier)** — test flow: trial gate, payment SePay, leaderboard, flashcard/quiz, recurrence, dual subtitle |
| `/cso` | Audit OWASP Top 10 + STRIDE, mỗi finding kèm kịch bản exploit | **Security review trước GĐ4** — soi auth Google, SePay webhook, RLS, `lookup_word`, rate limit, secret không lộ client |
| `/review` | Staff-engineer review, bắt bug "qua CI nhưng vỡ production" | Mỗi TIP build lớn (`web/backend`, `extension`) trước khi Thợ nộp Completion Report |

**Không dùng:** `/design-shotgun` (khách đã cung cấp Figma đầy đủ → không cần generate mockup từ đầu).

---

## ✋ CHECKPOINT — BLUEPRINT → TASK GRAPH

Đã chốt:
- [x] **D-1** Phụ đề VI = YouTube `tlang=vi`
- [x] **D-2** Nghĩa từ = từ điển EN-VI nhúng (tra cứu từng từ) — **ĐẢO CÓ KIỂM SOÁT 2026-07-02 (khách duyệt, TIP-038):** NGHĨA dùng AI GPT-4o-mini theo ngữ cảnh (`/api/lookup-context`, cache + fallback từ điển); IPA/audio giữ từ từ điển. Từ điển = fallback.
- [x] **Streak** = chuẩn Duolingo, timezone UTC+7 (mục 3)

Còn cần để sang bước tạo TIP:
- [ ] Human reply **"APPROVED"** Blueprint v1.4

Sau khi đủ, mình sẽ generate Task Graph + từng TIP (Gherkin AC) để giao Thợ.
