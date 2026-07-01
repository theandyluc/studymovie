-- TIP-033 — Calibrate Dashboard theo Figma.
-- Bổ sung 2 số liệu cho 3 vòng tròn stat: total_minutes (tổng giờ đã học, lifetime)
-- + vocab_learned (số từ vựng đã học = learned_at not null).
-- ADDITIVE + backward-compatible: chỉ THÊM field vào jsonb trả về, không đổi field cũ.
-- create or replace → idempotent. Web/extension cũ đọc field cũ vẫn chạy bình thường.

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
  v_total_sec  bigint;      -- TIP-033: tổng giờ đã học (lifetime)
  v_vocab_done int;         -- TIP-033: số từ vựng đã học
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
  v_day := v_today - 1;
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 3650;
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

  -- TIP-033: tổng giờ đã học (mọi thời gian) + số từ vựng đã học
  select coalesce(sum(duration_sec), 0) into v_total_sec
  from public.study_sessions where user_id = v_uid;

  select count(*) into v_vocab_done
  from public.vocabulary where user_id = v_uid and learned_at is not null;

  return jsonb_build_object(
    'streak', v_streak,
    'today_met', v_today_met,
    'today_minutes', (v_today_sec / 60)::int,
    'daily_commit_minutes', v_commit_min,
    'week', coalesce(v_week, '[]'::jsonb),
    'month', coalesce(v_month, '[]'::jsonb),
    'total_minutes', (v_total_sec / 60)::int,   -- TIP-033
    'vocab_learned', v_vocab_done               -- TIP-033
  );
end;
$$;
