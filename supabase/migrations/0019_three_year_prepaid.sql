-- 3-year prepaid package (one-time payment, 35% off 36 months, at least 3 staff).
-- Existing rows are untouched: every current row is 'month' or 'year'.
-- Proposal and reasoning: docs/three-year-plan.md. NOT yet applied to the live database.

-- 1) The interval may now be 'three_year'. That plan needs at least 3 staff (also for any planned reduction).
alter table public.business_billing drop constraint business_billing_billing_interval_check;
alter table public.business_billing add constraint business_billing_billing_interval_check
  check (billing_interval in ('month', 'year', 'three_year'));
alter table public.business_billing add constraint three_year_min_staff
  check (billing_interval <> 'three_year' or (staff_seats >= 3 and coalesce(next_staff_seats, 3) >= 3));
alter table public.business_billing add constraint three_year_no_sms
  check (billing_interval <> 'three_year' or (sms_packs = 0 and next_sms_packs is null));

-- 2) What was paid and when (refund window, support, renewal notices).
alter table public.business_billing
  add column prepaid_payment_intent_id text unique,
  add column prepaid_paid_at timestamptz,
  add column prepaid_notice_sent_at timestamptz;   -- time of the last renewal notice (like trial_reminder_sent_at)

-- 3) Price: three_year = monthly x 36 x 65 / 100 (SMS packs are not part of this plan and are ignored here).
create or replace function public.billing_price_pence(p_seats int, p_interval text, p_sms_packs int default 0) returns int
language sql immutable parallel safe set search_path = '' as $$
  select case p_interval
    when 'three_year' then ((1500 + 200 * (p_seats - 1)) * 36 * 65 / 100)::int
    else (1500 + 200 * (p_seats - 1)) * case p_interval when 'year' then 10 when 'month' then 1 end
       + 500 * coalesce(p_sms_packs, 0) * case p_interval when 'year' then 12 when 'month' then 1 end
  end;
$$;

-- 4) A shop can be created on the 3-year plan (it starts its free trial as usual; the payment comes later).
create or replace function public.create_business(
  p_name text, p_slug text, p_owner_name text, p_email text, p_phone text,
  p_seats int, p_interval text, p_sms_packs int default 0
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  bid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.business_members where user_id = uid) then
    raise exception 'user already belongs to a business' using errcode = 'P0001';
  end if;
  if p_seats is null or p_seats < 1 or p_seats > 50 then
    raise exception 'seats must be between 1 and 50' using errcode = '22023';
  end if;
  if p_interval is null or p_interval not in ('month', 'year', 'three_year') then
    raise exception 'invalid billing interval' using errcode = '22023';
  end if;
  if p_interval = 'three_year' and p_seats < 3 then
    raise exception 'the 3-year plan needs at least 3 staff' using errcode = '22023';
  end if;
  if p_sms_packs is null or p_sms_packs < 0 or p_sms_packs > 20 then
    raise exception 'sms packs must be between 0 and 20' using errcode = '22023';
  end if;
  if p_interval = 'three_year' and p_sms_packs <> 0 then
    raise exception 'the 3-year plan does not include sms packs' using errcode = '22023';
  end if;

  insert into public.businesses (name, slug, email, owner_name, phone)
  values (p_name, p_slug, p_email, p_owner_name, p_phone) returning id into bid;

  insert into public.business_members (business_id, user_id, role) values (bid, uid, 'owner');

  -- billing first: the staff insert below is checked against the seat limit
  insert into public.business_billing (business_id, billing_interval, staff_seats, sms_packs, sms_enabled, current_price_pence)
  values (bid, p_interval, p_seats, p_sms_packs, p_sms_packs > 0, public.billing_price_pence(p_seats, p_interval, p_sms_packs));

  insert into public.staff (business_id, user_id, name, email)
  values (bid, uid, p_owner_name, p_email);

  return bid;
end $$;

-- 5) Stripe subscription events must never overwrite a prepaid plan. (The body is the latest version, from 0016, plus the guard.)
create or replace function public.sync_subscription(
  p_business_id uuid, p_subscription_id text, p_customer_id text, p_status text,
  p_period_end timestamptz, p_interval text, p_quantity int, p_sms_quantity int default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.business_billing%rowtype; v_seats int; v_packs int; v_interval text; v_new_period boolean;
begin
  if p_status not in ('trialing', 'active', 'past_due', 'canceled', 'unpaid') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  select * into b from public.business_billing where business_id = p_business_id for update;
  if not found then
    raise exception 'billing record not found' using errcode = 'P0002';
  end if;

  if b.billing_interval = 'three_year' then
    return;   -- a prepaid 3-year plan is not a Stripe subscription: never overwritten by subscription events
  end if;

  v_new_period := b.stripe_subscription_id is distinct from p_subscription_id
                  or b.current_period_end is null or p_period_end > b.current_period_end;
  v_interval := case when p_interval in ('month', 'year') then p_interval else b.billing_interval end;
  v_seats := least(50, greatest(b.staff_seats, coalesce(p_quantity, b.staff_seats)));
  v_packs := least(20, greatest(b.sms_packs, coalesce(p_sms_quantity, b.sms_packs)));

  update public.business_billing set
    stripe_subscription_id = p_subscription_id,
    stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
    status = p_status,
    current_period_end = p_period_end,
    billing_interval = v_interval,
    staff_seats = v_seats,
    sms_packs = v_packs,
    current_price_pence = public.billing_price_pence(v_seats, v_interval, v_packs),
    next_staff_seats = case when next_staff_seats < v_seats then next_staff_seats end,
    next_sms_packs = case when next_sms_packs < v_packs then next_sms_packs end
  where business_id = p_business_id;

  update public.business_billing set
    next_price_pence = case when next_staff_seats is null and next_sms_packs is null then null else
      public.billing_price_pence(coalesce(next_staff_seats, staff_seats), billing_interval, coalesce(next_sms_packs, sms_packs)) end,
    change_effective_at = case when next_staff_seats is null and next_sms_packs is null then null else change_effective_at end
  where business_id = p_business_id;

  update public.business_billing set
    staff_seats = coalesce(next_staff_seats, staff_seats),
    sms_packs = coalesce(next_sms_packs, sms_packs),
    sms_enabled = sms_enabled and coalesce(next_sms_packs, sms_packs) > 0,
    current_price_pence = next_price_pence,
    next_staff_seats = null, next_sms_packs = null, next_price_pence = null, change_effective_at = null
  where business_id = p_business_id and next_price_pence is not null and change_effective_at <= now();

  if v_new_period then
    update public.business_billing set paid_this_period_pence = case when p_status = 'active' then current_price_pence else 0 end
    where business_id = p_business_id;
  end if;
end $$;

-- 6) Start the term once the payment is confirmed (service role only; called from the Stripe webhook).
--    Idempotent on the payment intent: the same webhook delivered twice changes nothing.
create function public.activate_prepaid_term(
  p_business_id uuid, p_payment_intent_id text, p_customer_id text, p_seats int, p_paid_at timestamptz
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_seats is null or p_seats < 3 or p_seats > 50 then
    raise exception 'seats must be 3 to 50' using errcode = '22023';
  end if;
  perform 1 from public.business_billing where business_id = p_business_id for update;
  if not found then
    raise exception 'billing record not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.business_billing where prepaid_payment_intent_id = p_payment_intent_id) then
    return;
  end if;
  update public.business_billing set
    status = 'active', billing_interval = 'three_year', staff_seats = p_seats, sms_packs = 0, sms_enabled = false,
    next_staff_seats = null, next_sms_packs = null, next_price_pence = null, change_effective_at = null,
    current_price_pence = public.billing_price_pence(p_seats, 'three_year'),
    current_period_end = p_paid_at + interval '3 years',
    paid_this_period_pence = public.billing_price_pence(p_seats, 'three_year'),
    stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
    stripe_subscription_id = null,
    prepaid_payment_intent_id = p_payment_intent_id, prepaid_paid_at = p_paid_at, prepaid_notice_sent_at = null
  where business_id = p_business_id;
end $$;
revoke all on function public.activate_prepaid_term(uuid, text, text, int, timestamptz) from public, anon, authenticated;
grant execute on function public.activate_prepaid_term(uuid, text, text, int, timestamptz) to service_role;

-- 7) End of term: close prepaid businesses whose three years are over (called by the cron job).
create function public.expire_prepaid_terms() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with u as (
    update public.business_billing set status = 'canceled'
    where billing_interval = 'three_year' and status = 'active' and stripe_subscription_id is null
      and current_period_end <= now()
    returning 1)
  select count(*)::int into n from u;
  return n;
end $$;
revoke all on function public.expire_prepaid_terms() from public, anon, authenticated;
grant execute on function public.expire_prepaid_terms() to service_role;
