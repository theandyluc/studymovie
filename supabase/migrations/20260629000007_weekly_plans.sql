-- TIP-017 — Bảng "Kế hoạch tuần này" trên Dashboard (RIÊNG, KHÔNG đụng playlist_items).
-- Mọi ô là text tự do (ngày dd/mm/yyyy, thời gian cam kết "02h30m"...). RLS: user chỉ thấy dòng của mình.
-- Idempotent.

create table if not exists public.weekly_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  plan_date      text,           -- ngày dạng input text, vd "22/06/2026"
  video_link     text,           -- link video dự định học
  committed_time text,           -- thời gian cam kết, input tự do vd "02h30m"
  done           boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_weekly_plans_user on public.weekly_plans (user_id, created_at);

-- RLS: user chỉ select/insert/update/delete dòng của mình.
alter table public.weekly_plans enable row level security;

drop policy if exists weekly_plans_select on public.weekly_plans;
drop policy if exists weekly_plans_insert on public.weekly_plans;
drop policy if exists weekly_plans_update on public.weekly_plans;
drop policy if exists weekly_plans_delete on public.weekly_plans;

create policy weekly_plans_select on public.weekly_plans for select to authenticated using (auth.uid() = user_id);
create policy weekly_plans_insert on public.weekly_plans for insert to authenticated with check (auth.uid() = user_id);
create policy weekly_plans_update on public.weekly_plans for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy weekly_plans_delete on public.weekly_plans for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.weekly_plans to authenticated;
