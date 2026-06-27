-- TIP-002 / BE-03 — RPC core (SECURITY DEFINER + guard).
-- Timezone toàn hệ thống: Asia/Ho_Chi_Minh (UTC+7). Streak chuẩn Duolingo.
-- Leaderboard/streak = compute-on-read (KHÔNG cron, KHÔNG xoá data).

-- ============================================================
-- lookup_word(p_word) — lemmatize best-effort + tra dictionary. Đọc public.
-- ============================================================
create or replace function public.lookup_word(p_word text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_word text := lower(btrim(coalesce(p_word, '')));
  v_cands text[];
  v_base text;
  c text;
  v_hit public.dictionary%rowtype;
begin
  if auth.uid() is null and auth.role() <> 'service_role' then
    raise exception 'not authenticated';
  end if;
  if v_word = '' then
    return null;
  end if;

  -- Tập ứng viên lemma (thử lần lượt). Best-effort, không phải lemmatizer đầy đủ.
  v_cands := array[v_word];

  if v_word ~ 'ies$' then            -- studies -> study
    v_cands := v_cands || (left(v_word, length(v_word) - 3) || 'y');
  end if;
  if v_word ~ 'ied$' then            -- studied -> study
    v_cands := v_cands || (left(v_word, length(v_word) - 3) || 'y');
  end if;
  if v_word ~ 'es$' then             -- boxes -> box
    v_cands := v_cands || left(v_word, length(v_word) - 2);
  end if;
  if v_word ~ 's$' then              -- runs -> run
    v_cands := v_cands || left(v_word, length(v_word) - 1);
  end if;
  if v_word ~ 'ed$' then             -- walked -> walk
    v_cands := v_cands || left(v_word, length(v_word) - 2);
  end if;
  if v_word ~ 'ing$' then            -- making -> mak(e); running -> runn -> run
    v_base := left(v_word, length(v_word) - 3);
    v_cands := v_cands || v_base;            -- read+ing -> read
    v_cands := v_cands || (v_base || 'e');   -- mak+ing -> make
    if length(v_base) >= 2 and right(v_base, 1) = substr(v_base, length(v_base) - 1, 1) then
      v_cands := v_cands || left(v_base, length(v_base) - 1);  -- runn -> run
    end if;
  end if;

  foreach c in array v_cands loop
    select * into v_hit from public.dictionary where lemma = c limit 1;
    if found then
      return jsonb_build_object(
        'lemma', v_hit.lemma,
        'ipa', v_hit.ipa,
        'meanings', v_hit.meanings,
        'audio_url', v_hit.audio_url
      );
    end if;
  end loop;

  return null;  -- không tìm thấy: trả null, không lỗi
end;
$$;

-- ============================================================
-- today_minutes(p_user_id) — phút đã học hôm nay (UTC+7).
-- Guard: chỉ chính chủ hoặc service_role.
-- ============================================================
create or replace function public.today_minutes(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz   constant text := 'Asia/Ho_Chi_Minh';
  v_today date := (now() at time zone v_tz)::date;
  v_sec  bigint;
begin
  if p_user_id is distinct from auth.uid() and auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;

  select coalesce(sum(duration_sec), 0) into v_sec
  from public.study_sessions
  where user_id = p_user_id
    and (started_at at time zone v_tz)::date = v_today;

  return (v_sec / 60)::int;
end;
$$;

-- ============================================================
-- get_dashboard() — cho auth.uid(): streak (Duolingo), today_met,
-- phút hôm nay, mảng giờ học tuần (7 ngày) + tháng (30 ngày).
-- ============================================================
create or replace function public.get_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_tz         constant text := 'Asia/Ho_Chi_Minh';
  v_today      date := (now() at time zone v_tz)::date;
  v_commit_min int;
  v_goal_sec   int;
  v_today_sec  bigint;
  v_today_met  boolean;
  v_streak     int := 0;
  v_day        date;
  v_day_sec    bigint;
  v_guard      int := 0;
  v_week       jsonb;
  v_month      jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(daily_commit_minutes, 30) into v_commit_min
  from public.profiles where id = v_uid;
  v_commit_min := coalesce(v_commit_min, 30);
  v_goal_sec := v_commit_min * 60;

  -- Hôm nay
  select coalesce(sum(duration_sec), 0) into v_today_sec
  from public.study_sessions
  where user_id = v_uid and (started_at at time zone v_tz)::date = v_today;
  v_today_met := v_today_sec >= v_goal_sec;

  -- Streak = số ngày liên tiếp ĐẠT tính tới HÔM QUA; hôm nay đạt thì +1.
  -- Hôm nay chưa đạt -> giữ nguyên (không reset). Reset 0 chỉ khi 1 ngày trôi qua không đạt.
  v_day := v_today - 1;
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 3650;  -- chặn vòng lặp vô hạn (~10 năm)
    select coalesce(sum(duration_sec), 0) into v_day_sec
    from public.study_sessions
    where user_id = v_uid and (started_at at time zone v_tz)::date = v_day;
    exit when v_day_sec < v_goal_sec;
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;
  if v_today_met then
    v_streak := v_streak + 1;
  end if;

  -- Tuần: 7 ngày gần nhất (today-6 .. today)
  select jsonb_agg(jsonb_build_object('date', d, 'minutes', mins) order by d) into v_week
  from (
    select gd::date as d,
           coalesce((select sum(duration_sec) from public.study_sessions
                     where user_id = v_uid and (started_at at time zone v_tz)::date = gd::date), 0) / 60 as mins
    from generate_series(v_today - 6, v_today, interval '1 day') gd
  ) w;

  -- Tháng: 30 ngày gần nhất (today-29 .. today)
  select jsonb_agg(jsonb_build_object('date', d, 'minutes', mins) order by d) into v_month
  from (
    select gd::date as d,
           coalesce((select sum(duration_sec) from public.study_sessions
                     where user_id = v_uid and (started_at at time zone v_tz)::date = gd::date), 0) / 60 as mins
    from generate_series(v_today - 29, v_today, interval '1 day') gd
  ) m;

  return jsonb_build_object(
    'streak', v_streak,
    'today_met', v_today_met,
    'today_minutes', (v_today_sec / 60)::int,
    'daily_commit_minutes', v_commit_min,
    'week', coalesce(v_week, '[]'::jsonb),
    'month', coalesce(v_month, '[]'::jsonb)
  );
end;
$$;

-- ============================================================
-- get_leaderboard_weekly() — top theo SUM(duration_sec) trong TUẦN ISO hiện tại
-- (compute-on-read theo UTC+7). Luôn kèm dòng caller dù ngoài top.
-- ============================================================
create or replace function public.get_leaderboard_weekly()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_tz            constant text := 'Asia/Ho_Chi_Minh';
  v_local         date := (now() at time zone v_tz)::date;
  v_week_start    date := v_local - (extract(isodow from v_local)::int - 1);  -- thứ Hai
  v_week_start_ts timestamptz := (v_week_start::timestamp) at time zone v_tz;
  v_week_end_ts   timestamptz := ((v_week_start + 7)::timestamp) at time zone v_tz;
  v_result        jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  with weekly as (
    select s.user_id, sum(s.duration_sec) as total_sec
    from public.study_sessions s
    where s.started_at >= v_week_start_ts and s.started_at < v_week_end_ts
    group by s.user_id
  ),
  ranked as (
    select w.user_id, w.total_sec,
           row_number() over (order by w.total_sec desc, w.user_id) as rank,
           p.nickname, p.avatar_url
    from weekly w
    join public.profiles p on p.id = w.user_id
  ),
  top as (
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'rank', rank, 'user_id', user_id, 'nickname', nickname,
        'avatar_url', avatar_url, 'minutes', (total_sec / 60)::int
      ) order by rank),
      '[]'::jsonb
    ) as j
    from ranked where rank <= 20
  ),
  caller as (
    select case
      -- đã nằm trong top -> không cần append riêng
      when exists (select 1 from ranked where user_id = v_uid and rank <= 20) then null
      -- có học trong tuần nhưng ngoài top
      when exists (select 1 from ranked where user_id = v_uid) then (
        select jsonb_build_object('rank', rank, 'user_id', user_id, 'nickname', nickname,
                 'avatar_url', avatar_url, 'minutes', (total_sec / 60)::int)
        from ranked where user_id = v_uid
      )
      -- chưa học trong tuần -> dòng 0 phút
      else (
        select jsonb_build_object('rank', null, 'user_id', v_uid, 'nickname', p.nickname,
                 'avatar_url', p.avatar_url, 'minutes', 0)
        from public.profiles p where p.id = v_uid
      )
    end as j
  )
  select jsonb_build_object(
    'week_start', v_week_start,
    'top', (select j from top),
    'caller', (select j from caller)
  ) into v_result;

  return v_result;
end;
$$;

-- ============================================================
-- GRANT EXECUTE cho authenticated (service_role có sẵn quyền).
-- ============================================================
grant execute on function public.lookup_word(text)        to authenticated;
grant execute on function public.today_minutes(uuid)       to authenticated;
grant execute on function public.get_dashboard()           to authenticated;
grant execute on function public.get_leaderboard_weekly()  to authenticated;
