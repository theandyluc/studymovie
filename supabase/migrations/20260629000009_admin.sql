-- TIP-020 — Admin: is_admin + app_settings (giá Pro) + RPC admin FAIL-CLOSED.
-- ⚠️ BẢO MẬT: mọi RPC admin kiểm tra is_caller_admin() ở ĐẦU hàm → raise 'forbidden' nếu không phải admin.
-- Không dựa UI. User thường gọi trực tiếp đều bị từ chối. Idempotent.

-- ============================================================
-- 1. profiles.is_admin + bảng app_settings (key-value)
-- ============================================================
alter table public.profiles add column if not exists is_admin boolean not null default false;

create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
-- RLS bật, KHÔNG policy cho authenticated → client KHÔNG đọc/ghi trực tiếp.
-- Backend đọc giá qua service_role (bypass RLS); admin ghi qua RPC security definer.
alter table public.app_settings enable row level security;

-- ============================================================
-- 2. Helper: caller có phải admin? (fail-closed: null/không có dòng → false)
-- ============================================================
create or replace function public.is_caller_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ============================================================
-- 3. admin_get_stats() → {total_users, pro_users, revenue}
-- ============================================================
create or replace function public.admin_get_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_total int; v_pro int; v_rev bigint;
begin
  if not public.is_caller_admin() then raise exception 'forbidden'; end if;
  select count(*) into v_total from public.profiles;
  select count(*) into v_pro from public.subscriptions where paid_until is not null and paid_until > now();
  select coalesce(sum(amount), 0) into v_rev from public.payment_orders where status = 'paid';
  return jsonb_build_object('total_users', v_total, 'pro_users', v_pro, 'revenue', v_rev);
end;
$$;

-- ============================================================
-- 4. admin_list_users() → [{id,email,created_at,status,paid_until,is_admin}]
-- ============================================================
create or replace function public.admin_list_users()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_rows jsonb;
begin
  if not public.is_caller_admin() then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'created_at', p.created_at,
    'is_admin', p.is_admin,
    'paid_until', s.paid_until,
    'status', case
      when s.paid_until is not null and s.paid_until > now() then 'paid'
      when now() < p.created_at + interval '24 hours' then 'trial'
      else 'expired' end
  ) order by p.created_at desc), '[]'::jsonb)
  into v_rows
  from public.profiles p
  left join public.subscriptions s on s.user_id = p.id;
  return v_rows;
end;
$$;

-- ============================================================
-- 5. admin_set_pro_price(p_price int) → app_settings.pro_price
-- ============================================================
create or replace function public.admin_set_pro_price(p_price int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_caller_admin() then raise exception 'forbidden'; end if;
  if p_price is null or p_price <= 0 then raise exception 'invalid price'; end if;
  insert into public.app_settings(key, value, updated_at)
  values ('pro_price', p_price::text, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

-- ============================================================
-- 6. admin_grant_pro(p_user_id uuid, p_days int) → gán Pro free (cộng dồn)
-- ============================================================
create or replace function public.admin_grant_pro(p_user_id uuid, p_days int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_caller_admin() then raise exception 'forbidden'; end if;
  if p_days is null or p_days <= 0 then raise exception 'invalid days'; end if;
  insert into public.subscriptions(user_id, status, paid_until)
  values (p_user_id, 'active', now() + (p_days || ' days')::interval)
  on conflict (user_id) do update
    set status = 'active',
        paid_until = greatest(now(), coalesce(public.subscriptions.paid_until, now())) + (p_days || ' days')::interval;
end;
$$;

-- ============================================================
-- 7. admin_set_admin(p_user_id uuid, p_is_admin bool) → set quyền admin
--    Không cho tự gỡ admin của CHÍNH MÌNH (tránh tự khóa toàn hệ thống).
-- ============================================================
create or replace function public.admin_set_admin(p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_caller_admin() then raise exception 'forbidden'; end if;
  if p_user_id = auth.uid() and p_is_admin = false then
    raise exception 'cannot remove your own admin rights';
  end if;
  update public.profiles set is_admin = p_is_admin where id = p_user_id;
end;
$$;

-- ============================================================
-- 8. GRANT execute (bảo mật nằm TRONG hàm — is_caller_admin, không ở grant)
-- ============================================================
grant execute on function public.is_caller_admin()                       to authenticated;
grant execute on function public.admin_get_stats()                       to authenticated;
grant execute on function public.admin_list_users()                      to authenticated;
grant execute on function public.admin_set_pro_price(int)                to authenticated;
grant execute on function public.admin_grant_pro(uuid, int)              to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean)          to authenticated;

-- ============================================================
-- 9. BOOTSTRAP admin đầu tiên — Homeowner chạy TAY (admin đầu không thể qua UI).
--    (Chạy riêng sau khi migration xong; đổi email nếu cần.)
-- ============================================================
-- update public.profiles set is_admin = true where email = 'dokhiem562@gmail.com';
