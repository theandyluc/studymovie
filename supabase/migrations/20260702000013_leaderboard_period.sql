-- TIP-058 — Bảng xếp hạng theo KỲ: tuần / tháng / toàn thời gian.
-- RPC get_leaderboard(p_period) MIRROR get_leaderboard_weekly, chỉ đổi khoảng thời gian.
-- GIỮ get_leaderboard_weekly() (KHÔNG drop) — tương thích ngược.

create or replace function public.get_leaderboard(p_period text default 'week')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_tz       constant text := 'Asia/Ho_Chi_Minh';
  v_local    date := (now() at time zone v_tz)::date;
  v_period   text := case when p_period in ('week', 'month', 'all') then p_period else 'week' end;
  v_start    date;
  v_start_ts timestamptz;
  v_end_ts   timestamptz;
  v_result   jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if v_period = 'month' then
    v_start := date_trunc('month', v_local)::date;
    v_start_ts := (v_start::timestamp) at time zone v_tz;
    v_end_ts := ((date_trunc('month', v_local) + interval '1 month')::timestamp) at time zone v_tz;
  elsif v_period = 'all' then
    v_start := null;
    v_start_ts := '-infinity'::timestamptz;
    v_end_ts := 'infinity'::timestamptz;
  else -- week: thứ Hai đầu tuần ISO .. +7
    v_start := v_local - (extract(isodow from v_local)::int - 1);
    v_start_ts := (v_start::timestamp) at time zone v_tz;
    v_end_ts := ((v_start + 7)::timestamp) at time zone v_tz;
  end if;

  with agg as (
    select s.user_id, sum(s.duration_sec) as total_sec
    from public.study_sessions s
    where s.started_at >= v_start_ts and s.started_at < v_end_ts
    group by s.user_id
  ),
  ranked as (
    select a.user_id, a.total_sec,
           row_number() over (order by a.total_sec desc, a.user_id) as rank,
           p.nickname, p.avatar_url
    from agg a
    join public.profiles p on p.id = a.user_id
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
      when exists (select 1 from ranked where user_id = v_uid and rank <= 20) then null
      when exists (select 1 from ranked where user_id = v_uid) then (
        select jsonb_build_object('rank', rank, 'user_id', user_id, 'nickname', nickname,
                 'avatar_url', avatar_url, 'minutes', (total_sec / 60)::int)
        from ranked where user_id = v_uid
      )
      else (
        select jsonb_build_object('rank', null, 'user_id', v_uid, 'nickname', p.nickname,
                 'avatar_url', p.avatar_url, 'minutes', 0)
        from public.profiles p where p.id = v_uid
      )
    end as j
  )
  select jsonb_build_object(
    'week_start', v_start,
    'top', (select j from top),
    'caller', (select j from caller)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_leaderboard(text) to authenticated;
