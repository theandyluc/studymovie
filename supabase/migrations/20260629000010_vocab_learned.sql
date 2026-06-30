-- TIP-024 — Theo dõi từ đã học qua flashcard.
-- learned_at NULL = "Từ mới" (chưa học qua flashcard); có giá trị = "Đã học".
-- KHÔNG đổi RLS/policy vocabulary (đã có từ TIP-002). Idempotent.
alter table public.vocabulary add column if not exists learned_at timestamptz;
