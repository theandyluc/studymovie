-- TIP-101 — Đảo D-1: dịch phụ đề bằng GPT-4o-mini (thay YouTube tlang), bám tiến độ xem.
-- Cache cũ (theo tlang, chỉ có `vi`) không tương thích format mới (cần cặp en+vi index-paired) —
-- an toàn xoá vì đây chỉ là cache hiệu năng, tự tính lại được, KHÔNG mất dữ liệu người dùng.
truncate table public.vi_caption_cache;

alter table public.vi_caption_cache add column en jsonb not null default '[]'::jsonb;
alter table public.vi_caption_cache alter column en drop default;

-- Cột `vi` (jsonb) giữ nguyên từ trước, đổi Ý NGHĨA sang: mảng string[] rải rác cùng độ dài
-- với `en` — phần tử "" nghĩa là câu đó chưa ai xem/dịch tới.
