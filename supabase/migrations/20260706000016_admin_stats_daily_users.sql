-- TIP-097 — admin_get_stats(): thêm daily_new_users (7 ngày gần nhất, giờ VN) để trang /admin
-- vẽ biểu đồ "Tổng user" theo ngày (giống LearnedChart ở /tu-vung) thay vì chỉ 1 con số tổng.
-- MIRROR admin_get_stats() ở 20260629000009, chỉ thêm field mới — không đổi field cũ.
create or replace function public.admin_get_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_pro int;
  v_rev bigint;
  v_tz constant text := 'Asia/Ho_Chi_Minh';
  v_today date := (now() at time zone v_tz)::date;
  v_daily jsonb;
begin
  if not public.is_caller_admin() then raise exception 'forbidden'; end if;
  select count(*) into v_total from public.profiles;
  select count(*) into v_pro from public.subscriptions where paid_until is not null and paid_until > now();
  select coalesce(sum(amount), 0) into v_rev from public.payment_orders where status = 'paid';

  select jsonb_agg(jsonb_build_object('date', d, 'count', coalesce(c.cnt, 0)) order by d)
  into v_daily
  from generate_series(v_today - 6, v_today, interval '1 day') as d
  left join (
    select (created_at at time zone v_tz)::date as day, count(*) as cnt
    from public.profiles
    where created_at >= ((v_today - 6)::timestamp) at time zone v_tz
    group by (created_at at time zone v_tz)::date
  ) c on c.day = d::date;

  return jsonb_build_object('total_users', v_total, 'pro_users', v_pro, 'revenue', v_rev, 'daily_new_users', v_daily);
end;
$$;

grant execute on function public.admin_get_stats() to authenticated;
