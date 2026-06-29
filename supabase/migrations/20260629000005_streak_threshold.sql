-- TIP-014 — Streak ngưỡng >10 phút/ngày.
-- ĐỔI: ngày được tính cho streak chỉ khi tổng duration_sec trong ngày (UTC+7) > 600s.
-- (Trước đây streak dùng goal = daily_commit_minutes.) Các phần khác của dashboard
-- (today_minutes, today_met theo cam kết, week, month) GIỮ NGUYÊN cách tính.
-- create or replace -> idempotent.

create or replace function public.get_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_tz           constant text := 'Asia/Ho_Chi_Minh';
  v_streak_min   constant int := 600;  -- ngưỡng streak: >10 phút/ngày
  v_today        date := (now() at time zone v_tz)::date;
  v_commit_min   int;
  v_goal_sec     int;
  v_today_sec    bigint;
  v_today_met    boolean;
  v_streak       int := 0;
  v_day          date;
  v_day_sec      bigint;
  v_guard        int := 0;
  v_week         jsonb;
  v_month        jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(daily_commit_minutes, 30) into v_commit_min
  from public.profiles where id = v_uid;
  v_commit_min := coalesce(v_commit_min, 30);
  v_goal_sec := v_commit_min * 60;

  -- Hôm nay (tổng giây học)
  select coalesce(sum(duration_sec), 0) into v_today_sec
  from public.study_sessions
  where user_id = v_uid and (started_at at time zone v_tz)::date = v_today;
  v_today_met := v_today_sec >= v_goal_sec;  -- "đạt cam kết" (GIỮ NGUYÊN, cho progress bar)

  -- Streak = số ngày liên tiếp có tổng > 600s tính tới HÔM QUA; hôm nay > 600s thì +1.
  v_day := v_today - 1;
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 3650;  -- chặn vòng lặp vô hạn (~10 năm)
    select coalesce(sum(duration_sec), 0) into v_day_sec
    from public.study_sessions
    where user_id = v_uid and (started_at at time zone v_tz)::date = v_day;
    exit when v_day_sec <= v_streak_min;  -- ngày <=10 phút -> đứt streak
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;
  if v_today_sec > v_streak_min then
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

grant execute on function public.get_dashboard() to authenticated;
