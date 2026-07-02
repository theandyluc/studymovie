-- TIP-038 — Cache nghĩa theo NGỮ CẢNH (OpenAI gpt-4o-mini).
-- 1 cặp (word + sentence) chỉ gọi AI 1 lần; lần sau trả từ cache.
-- Chỉ BACKEND (service_role, bypass RLS) đọc/ghi — client KHÔNG truy cập trực tiếp.
-- sentence được backend cắt <=500 ký tự trước khi làm khoá (tránh vượt giới hạn index btree).

create table if not exists public.ai_context_meaning (
  word       text not null,
  sentence   text not null,
  meaning_vi text not null,
  created_at timestamptz not null default now(),
  primary key (word, sentence)
);

alter table public.ai_context_meaning enable row level security;
-- KHÔNG tạo policy → mặc định deny; chỉ service_role (backend) truy cập được.
