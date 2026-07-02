# CLAUDE.md — StudyMovie Harness

> Operating manual cho agent (Thợ / Claude Code). **Đọc file này đầu mỗi session.**
> Đây là tầng *harness* (Instructions · State · Verification · Scope · Lifecycle) chạy
> BÊN TRONG quy trình Vibecode Kit v6.0. Harness không thay Vibecode — nó là môi trường
> để Thợ thực thi TIP một cách đáng tin cậy qua nhiều session.

---

## 1. Project (1 đoạn)

StudyMovie giúp người Việt học tiếng Anh qua xem YouTube với phụ đề song ngữ + ôn từ vựng
trên web. Gồm 3 khối dùng chung 1 tài khoản Google + 1 DB: **Chrome Extension (MV3)**,
**Web Frontend (Next.js)**, **Backend API** (dùng chung cho web + extension) → **Supabase**.
Chi tiết kiến trúc, data model, REQ: xem `StudyMovie-Blueprint.md` (nguồn chân lý thiết kế).

## 2. Bản đồ repo (progressive disclosure — đọc theo nhu cầu, không đọc hết một lúc)

```
studymovie/
├── CLAUDE.md                 # file này — quy tắc + lifecycle
├── StudyMovie-Blueprint.md   # thiết kế đầy đủ (kiến trúc/data model/REQ/quyết định)
├── feature_list.json         # STATE: feature nào done/đang làm/chưa
├── claude-progress.md        # STATE: nhật ký từng session
├── init.sh                   # chạy đầu session: install + verify + health
├── .env.example              # tên biến môi trường (không giá trị thật)
├── extension/                # Chrome Extension (MV3)
├── web/
│   ├── frontend/             # Next.js (UI)
│   └── backend/              # API service (dùng chung web + extension)
└── supabase/migrations/      # schema + RLS + RPC (nguồn tái tạo DB)
```

## 3. GOLDEN RULES (vi phạm = dừng lại)

1. **Một feature/TIP mỗi lần.** Không làm dở 3 thứ cùng lúc. Không overreach ngoài scope TIP.
2. **Không tự tuyên bố "done".** Chỉ `verification pass` mới tính. Confidence ≠ correctness.
3. **Đọc state trước khi làm.** `feature_list.json` + `claude-progress.md` + `git log` trước khi chọn việc.
4. **Cập nhật state sau khi làm.** Cập nhật `feature_list.json` + ghi `claude-progress.md` cuối mỗi session.
5. **Commit clean state.** Chỉ commit khi repo ở trạng thái resume được. Để lại đường khởi động sạch cho session sau.
6. **Đường dẫn rõ ràng khi `git add`.** Không `git add -A`. Add đúng path đã đụng.
7. **Fix-forward.** Sửa bằng commit mới, không amend + force-push.

## 4. Quyết định kiến trúc CHỐT (không đảo nếu không re-confirm — xem Blueprint mục 0 & 10)

- **D-1 Phụ đề câu = YouTube auto-translate** (`timedtext` + `tlang=vi`). KHÔNG dịch trả phí.
- **D-2 Nghĩa từ = từ điển EN-VI nhúng** (lookup, KHÔNG dịch máy, KHÔNG ghép word-by-word). **[ĐẢO CÓ KIỂM SOÁT — khách duyệt 2026-07-02, TIP-038]:** NGHĨA giờ dùng **AI GPT-4o-mini (OpenAI)** chọn theo ngữ cảnh câu (backend `/api/lookup-context`, có cache + **fallback về từ điển**); IPA/audio vẫn từ từ điển. Từ điển FVDP + lemmatize giữ làm fallback. Secret `OPENAI_API_KEY` chỉ ở backend.
  Trước khi tra phải **lemmatize** (running→run). Tra TỪNG TỪ khi user click.
- **Backend API là tầng giữa dùng chung** cho web frontend + extension. Client không gọi thẳng DB cho nghiệp vụ.
- **Secret đi qua serverless**, không nằm ở extension/client.
- **Leaderboard + streak = compute-on-read** theo tuần ISO. KHÔNG cron, KHÔNG xoá data.
- **Trial/subscription check server-side** theo `now()` server.
- **Supabase region = Singapore** (để transfer được khi bàn giao — Cách B).
- **Web build trước Extension.**

## 5. Scope boundaries

IN: extension YouTube (EXT-01..07), web 9 trang (WEB-01..09), backend (BE-01..06), VietQR+SePay.
OUT: **Netflix**, app mobile native, dịch nghĩa theo ngữ cảnh bằng AI, khắc phục video không có caption gốc.

## 6. Verification (lệnh — chạy trước khi tính một feature là done)

> Điều chỉnh theo công cụ thực tế sau khi scaffold. Mặc định đề xuất:

```bash
# Frontend
cd web/frontend && npm run lint && npm run typecheck && npm run build
# Backend
cd web/backend  && npm run lint && npm run typecheck && npm test
# Extension
cd extension    && npm run lint && npm run build
# DB: migration chạy sạch trên project _dev / preview
supabase db reset --linked   # hoặc quy trình migration của dự án
```

Một feature CHỈ chuyển sang `done` khi: lint sạch + typecheck pass + test liên quan pass +
(với UI/flow) `gstack /qa` chạy qua flow thật không lỗi. Chuyển `verified` khi đã runtime-verify trên thiết bị.

## 7. Session Lifecycle (theo đúng mỗi session)

```
START
  1. Đọc CLAUDE.md (file này)
  2. Chạy ./init.sh  (install + verify + health check)
  3. Đọc claude-progress.md (session trước làm gì, còn gì dở)
  4. Đọc feature_list.json (done / next)
  5. git log --oneline -10 (thay đổi gần đây)
SELECT
  6. Chọn ĐÚNG MỘT feature/TIP chưa xong (ưu tiên theo Task Graph trong Blueprint)
  7. Đánh dấu feature đó status="in_progress" trong feature_list.json
EXECUTE
  8. Triển khai theo acceptance criteria của TIP (Gherkin)
  9. Chạy verification (mục 6)
  10. Fail → sửa & chạy lại. Pass → ghi evidence
WRAP UP
  11. feature_list.json: cập nhật status (done/verified) + ghi evidence
  12. claude-progress.md: thêm entry session (đã làm / còn dở / cách resume)
  13. git add <paths cụ thể> && commit (clean state)
  14. Nộp Completion Report cho Chủ thầu (theo Vibecode Kit)
```

## 8. Vibecode Kit ↔ Harness (ánh xạ)

| Vibecode | Harness |
|---|---|
| TIP (một task, Gherkin AC) | Scope = một feature/lần (mục 3.1) + acceptance |
| Thợ thi công | Agent execute trong Session Lifecycle |
| Completion Report | Verification evidence (mục 6) + entry progress |
| Chủ thầu review | Gate trước khi feature → `verified` |
| Re-read vibecode skill trước khi tạo TIP | Đọc Blueprint + feature_list trước khi SELECT |

## 9. Tooling (xem Blueprint mục 11)

gstack chỉ dùng làm công cụ điểm ở VERIFY: `/qa` (browser thật), `/cso` (security), `/review`.
**Cài global, KHÔNG team-init vào repo này** (giữ repo bàn giao sạch — Cách B).

## 10. Bàn giao (Cách B — xem Blueprint mục 9)

Các file harness NÀY (CLAUDE.md, feature_list.json, claude-progress.md, init.sh) là **tài sản dự án**
→ commit vào repo và bàn giao cho khách. Cuối dự án: transfer GitHub + Supabase + Vercel + đổi toàn bộ key
sang của khách; đảm bảo `.env.example` + `HANDOVER.md` đầy đủ.
