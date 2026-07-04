-- TIP-078 — Cache phụ đề Việt (VI) theo video_id, chia sẻ giữa mọi user.
-- Google (timedtext tlang=vi) thỉnh thoảng chặn anti-bot theo phiên trình duyệt cá nhân.
-- Người xem đầu tiên vẫn tự fetch từ trình duyệt (không đổi cơ chế) — thành công thì gửi
-- lên backend lưu cache; người xem sau cùng video đọc thẳng cache, không gọi Google nữa.
-- Chỉ BACKEND (service_role, bypass RLS) đọc/ghi — client KHÔNG truy cập trực tiếp.

create table if not exists public.vi_caption_cache (
  video_id   text primary key,
  vi         jsonb not null,
  cue_count  int not null,
  created_at timestamptz not null default now()
);

alter table public.vi_caption_cache enable row level security;
-- KHÔNG tạo policy → mặc định deny; chỉ service_role (backend) truy cập được.
