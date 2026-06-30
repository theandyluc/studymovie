-- TIP-019b — Trial 24h + access status.
-- has_access = còn trial (profiles.created_at + 24h) HOẶC đã trả (subscriptions.paid_until > now).
-- reason: 'paid' | 'trial' | 'expired'. Trial mốc = profiles.created_at (đã có sẵn, không cột mới).
-- paid_until đọc từ subscriptions (nơi TIP-013 ghi). security definer + auth.uid(). Idempotent.

create or replace function public.get_access_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_created   timestamptz;
  v_paid      timestamptz;
  v_trial_exp timestamptz;
  v_has       boolean;
  v_reason    text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select p.created_at, s.paid_until
    into v_created, v_paid
  from public.profiles p
  left join public.subscriptions s on s.user_id = p.id
  where p.id = v_uid;

  v_trial_exp := v_created + interval '24 hours';

  if v_paid is not null and v_paid > now() then
    v_has := true;  v_reason := 'paid';
  elsif v_created is not null and now() < v_trial_exp then
    v_has := true;  v_reason := 'trial';
  else
    v_has := false; v_reason := 'expired';
  end if;

  return jsonb_build_object(
    'has_access', v_has,
    'reason', v_reason,
    'trial_expires_at', v_trial_exp,
    'paid_until', v_paid
  );
end;
$$;

grant execute on function public.get_access_status() to authenticated;
