-- TIP-016 — Level system (CEFR A0..C2) trên Dashboard.
-- profiles + 2 cột; RPC set_current_level + get_level_progress (tự lên cấp, giờ reset mỗi cấp).
-- Giờ đếm cho cấp hiện tại = study_sessions kể từ level_started_at (không cộng dồn lịch sử).
-- Bảng giờ mục tiêu: A0→A1=95, A1→A2=95, A2→B1=185, B1→B2=175, B2→C1=200, C1→C2=350.
-- KHÔNG đụng get_dashboard cũ. Idempotent.

-- ============================================================
-- 1. Cột mới trên profiles
-- ============================================================
alter table public.profiles add column if not exists current_level   text;
alter table public.profiles add column if not exists level_started_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_current_level_chk') then
    alter table public.profiles
      add constraint profiles_current_level_chk
      check (current_level is null or current_level in ('A0','A1','A2','B1','B2','C1','C2'));
  end if;
end $$;

-- ============================================================
-- 2. set_current_level(p_level) — nhập lần đầu / đổi level (reset mốc giờ)
-- ============================================================
create or replace function public.set_current_level(p_level text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_level not in ('A0','A1','A2','B1','B2','C1','C2') then
    raise exception 'invalid level: %', p_level;
  end if;
  update public.profiles
    set current_level = p_level, level_started_at = now()
  where id = v_uid;
end;
$$;

-- ============================================================
-- 3. get_level_progress() — tính tiến độ + TỰ LÊN CẤP (side-effect update profiles)
-- ============================================================
create or replace function public.get_level_progress()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_level      text;
  v_started    timestamptz;
  v_next       text;
  v_target_h   numeric;
  v_studied_s  bigint;
  v_studied_h  numeric;
  v_just       boolean := false;
  v_old        text := null;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select current_level, level_started_at into v_level, v_started
  from public.profiles where id = v_uid;

  if v_level is null then
    return jsonb_build_object('needs_input', true);
  end if;

  -- Phòng trường hợp level đặt trước khi có cột mốc → coi như bắt đầu từ giờ.
  if v_started is null then
    update public.profiles set level_started_at = now() where id = v_uid;
    v_started := now();
  end if;

  select coalesce(sum(duration_sec), 0) into v_studied_s
  from public.study_sessions
  where user_id = v_uid and started_at >= v_started;
  v_studied_h := round(v_studied_s / 3600.0, 2);

  -- C2 = cao nhất, không mục tiêu.
  if v_level = 'C2' then
    return jsonb_build_object(
      'needs_input', false, 'current_level', 'C2',
      'is_max', true, 'studied_hours', v_studied_h
    );
  end if;

  v_target_h := case v_level
    when 'A0' then 95 when 'A1' then 95 when 'A2' then 185
    when 'B1' then 175 when 'B2' then 200 when 'C1' then 350 end;
  v_next := case v_level
    when 'A0' then 'A1' when 'A1' then 'A2' when 'A2' then 'B1'
    when 'B1' then 'B2' when 'B2' then 'C1' when 'C1' then 'C2' end;

  -- TỰ LÊN CẤP (1 cấp/lần gọi): đủ giờ → chuyển cấp + reset mốc.
  if v_studied_h >= v_target_h then
    v_old := v_level;
    v_level := v_next;
    v_just := true;
    update public.profiles
      set current_level = v_level, level_started_at = now()
    where id = v_uid;
    v_started := now();

    select coalesce(sum(duration_sec), 0) into v_studied_s
    from public.study_sessions
    where user_id = v_uid and started_at >= v_started;
    v_studied_h := round(v_studied_s / 3600.0, 2);

    if v_level = 'C2' then
      return jsonb_build_object(
        'needs_input', false, 'current_level', 'C2', 'is_max', true,
        'studied_hours', v_studied_h,
        'just_leveled_up', true, 'old_level', v_old, 'new_level', 'C2'
      );
    end if;

    v_target_h := case v_level
      when 'A1' then 95 when 'A2' then 185 when 'B1' then 175
      when 'B2' then 200 when 'C1' then 350 end;
    v_next := case v_level
      when 'A1' then 'A2' when 'A2' then 'B1' when 'B1' then 'B2'
      when 'B2' then 'C1' when 'C1' then 'C2' end;
  end if;

  return jsonb_build_object(
    'needs_input', false,
    'is_max', false,
    'current_level', v_level,
    'target_level', v_next,
    'target_hours', v_target_h,
    'studied_hours', v_studied_h,
    'remaining_hours', greatest(0, round(v_target_h - v_studied_h, 2)),
    'percent', least(100, round(v_studied_h / v_target_h * 100)),
    'just_leveled_up', v_just,
    'old_level', v_old,
    'new_level', case when v_just then v_level else null end
  );
end;
$$;

grant execute on function public.set_current_level(text) to authenticated;
grant execute on function public.get_level_progress()    to authenticated;
