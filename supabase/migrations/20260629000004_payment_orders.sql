-- TIP-013 / BE-04+BE-05 — Đơn thanh toán Pro (VietQR + SePay webhook).
-- 1 gói Pro 49.000đ/tháng. User tạo đơn (pending) -> chuyển khoản (nội dung CK chứa code) ->
-- SePay webhook đối soát -> order=paid + subscriptions.paid_until +1 tháng.
-- Idempotent migration (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- ============================================================
-- payment_orders
--   code        : mã đơn ngắn (SMxxxxxx) NHÚNG vào nội dung CK để đối soát. UNIQUE.
--   sepay_tx_id : payload.id của giao dịch SePay (TEXT) — UNIQUE = chống trùng webhook.
--   insert/update CHỈ qua backend service_role (RLS bypass). User chỉ SELECT đơn của mình.
-- ============================================================
create table if not exists public.payment_orders (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      int  not null,
  status      text not null default 'pending' check (status in ('pending','paid','expired')),
  sepay_tx_id text unique,
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);

create index if not exists idx_payment_orders_user    on public.payment_orders (user_id, created_at desc);
create index if not exists idx_payment_orders_status  on public.payment_orders (status);

-- ============================================================
-- RLS: user đọc đơn của mình. KHÔNG policy insert/update => client không tự ghi
-- (backend dùng service_role, bypass RLS, gán user_id tường minh).
-- ============================================================
alter table public.payment_orders enable row level security;

drop policy if exists payment_orders_select on public.payment_orders;
create policy payment_orders_select on public.payment_orders
  for select to authenticated using (auth.uid() = user_id);

grant usage  on schema public               to authenticated;
grant select on public.payment_orders       to authenticated;
