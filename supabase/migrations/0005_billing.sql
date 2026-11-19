-- Billing: per-business plan (staff seats + interval), trial, and a scheduled price
-- change for seat reductions. No Stripe objects are required during the free trial.

-- ----------------------------------------------------------- business contact details
alter table public.businesses
  add column owner_name text check (char_length(owner_name) between 1 and 100),
  add column phone text check (char_length(phone) <= 30);

-- ------------------------------------------------------------- the pricing formula
-- 1 staff = £15/month, each extra staff member +£2/month; yearly = 10 x monthly.
-- Prices are in pence, before VAT. The TypeScript twin lives in src/lib/pricing.ts and
-- a test checks the two agree for every seat count.
create function public.billing_price_pence(p_seats int, p_interval text) returns int
language sql immutable parallel safe set search_path = '' as $$
  select (1500 + 200 * (p_seats - 1)) *
    case p_interval when 'year' then 10 when 'month' then 1 end;
$$;

-- ------------------------------------------------------------------- business_billing
create table public.business_billing (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','canceled','unpaid')),
  trial_ends_at timestamptz not null default (now() + interval '60 days'),
  billing_interval text not null default 'month' check (billing_interval in ('month','year')),
  staff_seats int not null default 1 check (staff_seats between 1 and 50),
  current_price_pence int not null check (current_price_pence > 0),   -- per billing period, ex VAT
  -- A requested reduction takes effect at the end of the current period.
  next_staff_seats int check (next_staff_seats between 1 and 50),
  next_price_pence int check (next_price_pence > 0),
  change_effective_at timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,          -- null until real billing is switched on
  created_at timestamptz not null default now(),
  check (next_staff_seats is null or next_staff_seats < staff_seats),
  check ((next_staff_seats is null) = (next_price_pence is null)),
  check ((next_staff_seats is null) = (change_effective_at is null))
);

-- Move the old subscription columns here (single source of truth).
insert into public.business_billing (business_id, status, trial_ends_at, staff_seats, current_price_pence, stripe_customer_id)
select b.id,
       case b.subscription_status when 'incomplete' then 'trialing' else b.subscription_status end,
       b.trial_ends_at,
       least(50, greatest(1, (select count(*)::int from public.staff s where s.business_id = b.id and s.active))),
       public.billing_price_pence(
         least(50, greatest(1, (select count(*)::int from public.staff s where s.business_id = b.id and s.active))), 'month'),
       b.stripe_customer_id
from public.businesses b;

alter table public.businesses
  drop column subscription_status,
  drop column trial_ends_at,
  drop column stripe_customer_id;

alter table public.business_billing enable row level security;
grant select on public.business_billing to authenticated;   -- writes: server-side functions only
create policy billing_select on public.business_billing
  for select to authenticated using (private.is_owner(business_id));

-- ----------------------------------------------- the database enforces the seat limit
-- Active staff may not exceed the seats paid for, nor a scheduled lower seat count.
-- The billing row is locked so two simultaneous inserts can't both squeeze in.
create function public.enforce_staff_seats() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cap int; used int;
begin
  if not new.active then return new; end if;
  select least(b.staff_seats, coalesce(b.next_staff_seats, b.staff_seats)) into cap
  from public.business_billing b where b.business_id = new.business_id for update;
  if cap is null then return new; end if;
  select count(*) into used from public.staff s
  where s.business_id = new.business_id and s.active and s.id <> new.id;
  if used + 1 > cap then
    raise exception 'staff_seats_exceeded: % of % team seats are in use', used, cap;
  end if;
  return new;
end $$;

create trigger staff_seat_limit
  before insert or update of active, business_id on public.staff
  for each row execute function public.enforce_staff_seats();

-- --------------------------------------------------------------- changing seat count
-- Owner only. No subscription yet (trial): applies immediately, nothing is charged.
-- With a subscription: a reduction is scheduled for the end of the current period
-- (this period's price is unchanged); setting the current count again cancels it.
-- Increases on a live subscription must go through payment (added with Stripe).
create function public.change_staff_seats(p_business_id uuid, p_new_seats int) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.business_billing%rowtype; active_count int;
begin
  if not private.is_owner(p_business_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_new_seats is null or p_new_seats < 1 or p_new_seats > 50 then
    raise exception 'seats must be between 1 and 50' using errcode = '22023';
  end if;

  select * into b from public.business_billing where business_id = p_business_id for update;
  if not found then
    raise exception 'billing record not found' using errcode = 'P0002';
  end if;

  select count(*)::int into active_count from public.staff where business_id = p_business_id and active;
  if p_new_seats < active_count then
    raise exception 'staff_seats_below_active: % team members are active', active_count;
  end if;

  if b.stripe_subscription_id is null then
    update public.business_billing set
      staff_seats = p_new_seats,
      current_price_pence = public.billing_price_pence(p_new_seats, b.billing_interval),
      next_staff_seats = null, next_price_pence = null, change_effective_at = null
    where business_id = p_business_id;
  elsif p_new_seats > b.staff_seats then
    raise exception 'seat_increase_requires_payment';
  elsif p_new_seats = b.staff_seats then
    update public.business_billing set next_staff_seats = null, next_price_pence = null, change_effective_at = null
    where business_id = p_business_id;
  else
    if b.current_period_end is null then
      raise exception 'billing period is not known yet' using errcode = 'P0001';
    end if;
    update public.business_billing set
      next_staff_seats = p_new_seats,
      next_price_pence = public.billing_price_pence(p_new_seats, b.billing_interval),
      change_effective_at = b.current_period_end
    where business_id = p_business_id;
  end if;
end $$;

-- Applies scheduled reductions that have come due (called by the billing webhook/cron).
create function public.apply_due_seat_changes() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with u as (
    update public.business_billing set
      staff_seats = next_staff_seats, current_price_pence = next_price_pence,
      next_staff_seats = null, next_price_pence = null, change_effective_at = null
    where next_staff_seats is not null and change_effective_at <= now()
    returning 1)
  select count(*)::int into n from u;
  return n;
end $$;

-- ------------------------------------------------------------------- create_business
drop function public.create_business(text, text, text);

create function public.create_business(
  p_name text, p_slug text, p_owner_name text, p_email text, p_phone text,
  p_seats int, p_interval text
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
  if p_interval is null or p_interval not in ('month', 'year') then
    raise exception 'invalid billing interval' using errcode = '22023';
  end if;

  insert into public.businesses (name, slug, email, owner_name, phone)
  values (p_name, p_slug, p_email, p_owner_name, p_phone) returning id into bid;

  insert into public.business_members (business_id, user_id, role) values (bid, uid, 'owner');

  -- billing first: the staff insert below is checked against the seat limit
  insert into public.business_billing (business_id, billing_interval, staff_seats, current_price_pence)
  values (bid, p_interval, p_seats, public.billing_price_pence(p_seats, p_interval));

  insert into public.staff (business_id, user_id, name, email)
  values (bid, uid, p_owner_name, p_email);

  return bid;
end $$;

-- ---------------------------------------------------------------------------- grants
revoke all on function public.billing_price_pence(int, text) from public, anon;
revoke all on function public.change_staff_seats(uuid, int) from public, anon;
revoke all on function public.apply_due_seat_changes() from public, anon, authenticated;
revoke all on function public.create_business(text, text, text, text, text, int, text) from public, anon;
revoke all on function public.enforce_staff_seats() from public, anon, authenticated;
grant execute on function public.billing_price_pence(int, text) to authenticated, service_role;
grant execute on function public.change_staff_seats(uuid, int) to authenticated;
grant execute on function public.apply_due_seat_changes() to service_role;
grant execute on function public.create_business(text, text, text, text, text, int, text) to authenticated;
