-- Server-only functions for the public booking flow. They are SECURITY DEFINER and
-- executable by service_role only: browsers can never call them directly.

-- Atomic booking: validates service/staff belong to the business, frees expired
-- unpaid holds, upserts the customer, inserts the booking. The exclusion constraint
-- no_double_booking rejects overlaps (SQLSTATE 23P01) and rolls everything back.
create function public.create_booking(
  p_business_id uuid, p_service_id uuid, p_staff_id uuid, p_starts_at timestamptz,
  p_name text, p_email text, p_phone text, p_marketing_consent boolean,
  p_cancel_token_hash bytea, p_require_deposit boolean, p_hold_minutes int default 15
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  svc public.services%rowtype;
  cid uuid;
  bid uuid;
  v_status text;
begin
  select * into svc from public.services
  where id = p_service_id and business_id = p_business_id and active;
  if not found then
    raise exception 'service not available' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.staff s
    join public.staff_services ss on ss.staff_id = s.id and ss.service_id = p_service_id
    where s.id = p_staff_id and s.business_id = p_business_id and s.active
  ) then
    raise exception 'staff member not available for this service' using errcode = 'P0002';
  end if;

  if p_starts_at <= now() then
    raise exception 'start time is in the past' using errcode = 'P0001';
  end if;

  -- A deposit is never silently skipped.
  if svc.deposit_pence > 0 and not p_require_deposit then
    raise exception 'deposit payment is not available' using errcode = 'P0001';
  end if;

  -- Expired unpaid holds stop blocking the calendar.
  update public.bookings set status = 'expired'
  where business_id = p_business_id and status = 'pending_payment' and hold_expires_at < now();

  insert into public.customers (business_id, name, email, phone, marketing_consent, marketing_consent_at)
  values (p_business_id, p_name, lower(p_email), p_phone, p_marketing_consent,
          case when p_marketing_consent then now() end)
  on conflict (business_id, lower(email)) where email is not null
  do update set
    name = excluded.name,
    phone = excluded.phone,
    -- consent can be granted here, never silently withdrawn or re-stamped
    marketing_consent = public.customers.marketing_consent or excluded.marketing_consent,
    marketing_consent_at = case
      when not public.customers.marketing_consent and excluded.marketing_consent then now()
      else public.customers.marketing_consent_at end
  returning id into cid;

  v_status := case when svc.deposit_pence > 0 then 'pending_payment' else 'confirmed' end;

  insert into public.bookings (
    business_id, staff_id, service_id, customer_id, starts_at, ends_at,
    buffer_before_minutes, buffer_after_minutes, status, service_name, duration_minutes,
    price_pence, deposit_pence, deposit_status, hold_expires_at, cancel_token_hash)
  values (
    p_business_id, p_staff_id, p_service_id, cid, p_starts_at,
    p_starts_at + svc.duration_minutes * interval '1 minute',
    svc.buffer_before_minutes, svc.buffer_after_minutes, v_status, svc.name, svc.duration_minutes,
    svc.price_pence, svc.deposit_pence,
    case when v_status = 'pending_payment' then 'pending' else 'none' end,
    case when v_status = 'pending_payment' then now() + p_hold_minutes * interval '1 minute' end,
    p_cancel_token_hash)
  returning id into bid;

  return bid;
end $$;

-- Fixed-window rate limiter backed by the rate_limits table (no extra infrastructure).
-- Returns true while the caller is within the limit.
create function public.rate_limit_hit(p_key text, p_window_seconds int, p_limit int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c int;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, ws, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into c;

  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return c <= p_limit;
end $$;

revoke all on function public.create_booking(uuid, uuid, uuid, timestamptz, text, text, text, boolean, bytea, boolean, int)
  from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, uuid, uuid, timestamptz, text, text, text, boolean, bytea, boolean, int)
  to service_role;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
