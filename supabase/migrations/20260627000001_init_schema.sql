-- TIP-002 / BE-02 — Schema + RLS + trigger (StudyMovie Blueprint v1.4 mục 3)
-- Tất cả bảng user-data bật RLS: user chỉ thao tác dữ liệu của chính mình.
-- dictionary = dữ liệu tra cứu dùng chung (read-only cho authenticated).
-- Idempotent: dùng IF NOT EXISTS / DROP POLICY IF EXISTS.

-- ============================================================
-- 1. TABLES
-- ============================================================

-- profiles: hồ sơ user (1-1 với auth.users)
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text,
  nickname             text,
  avatar_url           text,
  daily_commit_minutes int not null default 30,
  created_at           timestamptz not null default now()
);

-- subscriptions: trạng thái trial/trả phí
create table if not exists public.subscriptions (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  status        text not null default 'trial' check (status in ('trial','active','expired')),
  trial_ends_at timestamptz,
  paid_until    timestamptz,
  created_at    timestamptz not null default now()
);

-- vocabulary: từ đã lưu từ extension
create table if not exists public.vocabulary (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  word       text not null,
  lemma      text,
  ipa        text,
  meaning_vi text,
  example    text,
  audio_url  text,
  created_at timestamptz not null default now(),
  unique (user_id, word)
);

-- study_sessions: mỗi lần Start→Stop = 1 record (nguồn dashboard/leaderboard/streak)
create table if not exists public.study_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  started_at   timestamptz not null,
  ended_at     timestamptz not null,
  duration_sec int not null,
  created_at   timestamptz not null default now()
);

-- playlist_items: video YouTube cho tuần (todo list)
create table if not exists public.playlist_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  youtube_url   text not null,
  video_id      text,
  title         text,
  thumbnail_url text,
  is_done       boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- dictionary: từ điển EN-VI nhúng — KHÔNG có user_id, đọc public.
create table if not exists public.dictionary (
  lemma     text primary key,
  ipa       text,
  meanings  jsonb,
  audio_url text
);

-- Indexes hỗ trợ truy vấn theo user + thời gian (dashboard/leaderboard/streak)
create index if not exists idx_study_sessions_user_started on public.study_sessions (user_id, started_at);
create index if not exists idx_vocabulary_user on public.vocabulary (user_id);
create index if not exists idx_playlist_user_sort on public.playlist_items (user_id, sort_order);

-- ============================================================
-- 2. RLS
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.vocabulary     enable row level security;
alter table public.study_sessions enable row level security;
alter table public.playlist_items enable row level security;
alter table public.dictionary     enable row level security;

-- profiles: auth.uid() = id
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (auth.uid() = id);
create policy profiles_insert on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy profiles_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_delete on public.profiles for delete to authenticated using (auth.uid() = id);

-- subscriptions: auth.uid() = user_id (insert/update do server/service-role lo nghiệp vụ thanh toán)
drop policy if exists subscriptions_select on public.subscriptions;
drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select to authenticated using (auth.uid() = user_id);
create policy subscriptions_update on public.subscriptions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- vocabulary: full CRUD trên dữ liệu của chính mình
drop policy if exists vocabulary_select on public.vocabulary;
drop policy if exists vocabulary_insert on public.vocabulary;
drop policy if exists vocabulary_update on public.vocabulary;
drop policy if exists vocabulary_delete on public.vocabulary;
create policy vocabulary_select on public.vocabulary for select to authenticated using (auth.uid() = user_id);
create policy vocabulary_insert on public.vocabulary for insert to authenticated with check (auth.uid() = user_id);
create policy vocabulary_update on public.vocabulary for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy vocabulary_delete on public.vocabulary for delete to authenticated using (auth.uid() = user_id);

-- study_sessions
drop policy if exists study_sessions_select on public.study_sessions;
drop policy if exists study_sessions_insert on public.study_sessions;
drop policy if exists study_sessions_update on public.study_sessions;
drop policy if exists study_sessions_delete on public.study_sessions;
create policy study_sessions_select on public.study_sessions for select to authenticated using (auth.uid() = user_id);
create policy study_sessions_insert on public.study_sessions for insert to authenticated with check (auth.uid() = user_id);
create policy study_sessions_update on public.study_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy study_sessions_delete on public.study_sessions for delete to authenticated using (auth.uid() = user_id);

-- playlist_items
drop policy if exists playlist_items_select on public.playlist_items;
drop policy if exists playlist_items_insert on public.playlist_items;
drop policy if exists playlist_items_update on public.playlist_items;
drop policy if exists playlist_items_delete on public.playlist_items;
create policy playlist_items_select on public.playlist_items for select to authenticated using (auth.uid() = user_id);
create policy playlist_items_insert on public.playlist_items for insert to authenticated with check (auth.uid() = user_id);
create policy playlist_items_update on public.playlist_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy playlist_items_delete on public.playlist_items for delete to authenticated using (auth.uid() = user_id);

-- dictionary: mọi authenticated user SELECT (read-only). KHÔNG policy insert/update/delete => client không ghi được.
drop policy if exists dictionary_select on public.dictionary;
create policy dictionary_select on public.dictionary for select to authenticated using (true);

-- ============================================================
-- 3. GRANTS (RLS vẫn lọc theo dòng; grant chỉ mở quyền câu lệnh)
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles       to authenticated;
grant select, update                 on public.subscriptions  to authenticated;
grant select, insert, update, delete on public.vocabulary     to authenticated;
grant select, insert, update, delete on public.study_sessions to authenticated;
grant select, insert, update, delete on public.playlist_items to authenticated;
grant select                         on public.dictionary     to authenticated;

-- ============================================================
-- 4. TRIGGER: user mới (auth.users insert) -> tạo profiles + subscriptions(trial 24h)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nickname, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, status, trial_ends_at)
  values (new.id, 'trial', now() + interval '24 hours')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
