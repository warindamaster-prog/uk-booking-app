-- SMS confirmations are an optional paid extra: packs of 50 texts a month, £5 a pack a month
-- (before VAT). Yearly plans pay 12 months for a pack (no yearly discount, unlike team seats).
-- Texts themselves are not sent yet (no SMS provider is connected): this is the choice and the money.

-- 1) Columns. A pack reduction is scheduled for the end of the period, like a seat reduction,
--    and both share one "from this date" and one "price from then".
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.business_billing'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%next_staff_seats%'
  loop
    execute format('alter table public.business_billing drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.business_billing
  add column sms_packs int not null default 0 check (sms_packs between 0 and 20),
  add column sms_enabled boolean not null default false,
  add column next_sms_packs int check (next_sms_packs between 0 and 20),
  add constraint sms_enabled_needs_pack check (not sms_enabled or sms_packs > 0),
  add constraint next_sms_below_current check (next_sms_packs is null or next_sms_packs < sms_packs),
  add constraint next_seats_range check (next_staff_seats between 1 and 50),
  add constraint next_seats_below_current check (next_staff_seats is null or next_staff_seats < staff_seats),
  add constraint next_price_iff_change check ((next_staff_seats is null and next_sms_packs is null) = (next_price_pence is null)),
  add constraint next_date_iff_price check ((next_price_pence is null) = (change_effective_at is null));

-- 2) Price: seats as before (yearly = 10 months) plus SMS packs (yearly = 12 months).
drop function public.billing_price_pence(int, text);
create function public.billing_price_pence(p_seats int, p_interval text, p_sms_packs int default 0) returns int
language sql immutable parallel safe set search_path = '' as $$
  select (1500 + 200 * (p_seats - 1)) * case p_interval when 'year' then 10 when 'month' then 1 end
       + 500 * coalesce(p_sms_packs, 0) * case p_interval when 'year' then 12 when 'month' then 1 end;
$$;

-- 3) Seat changes keep any planned pack change, and prices always include the packs.
create or replace function public.change_staff_seats(p_business_id uuid, p_new_seats int) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.business_billing%rowtype; active_count int; v_next_seats int; v_next_packs int; v_pending boolean;
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
      current_price_pence = public.billing_price_pence(p_new_seats, b.billing_interval, b.sms_packs),
      next_staff_seats = null, next_sms_packs = null, next_price_pence = null, change_effective_at = null
    where business_id = p_business_id;
  elsif p_new_seats > b.staff_seats then
    raise exception 'seat_increase_requires_payment';
  else
    v_next_seats := case when p_new_seats < b.staff_seats then p_new_seats end;
    v_next_packs := b.next_sms_packs;
    v_pending := v_next_seats is not null or v_next_packs is not null;
    if v_pending and coalesce(b.change_effective_at, b.current_period_end) is null then
      raise exception 'billing period is not known yet' using errcode = 'P0001';
    end if;
    update public.business_billing set
      next_staff_seats = v_next_seats,
      next_price_pence = case when v_pending then
        public.billing_price_pence(coalesce(v_next_seats, b.staff_seats), b.billing_interval, coalesce(v_next_packs, b.sms_packs)) end,
      change_effective_at = case when v_pending then coalesce(b.change_effective_at, b.current_period_end) end
    where business_id = p_business_id;
  end if;
end $$;

-- 4) Changing the number of SMS packs. Same rules as seats.
create function public.change_sms_packs(p_business_id uuid, p_new_packs int) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.business_billing%rowtype; v_next_seats int; v_next_packs int; v_pending boolean;
begin
  if not private.is_owner(p_business_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_new_packs is null or p_new_packs < 0 or p_new_packs > 20 then
    raise exception 'sms packs must be between 0 and 20' using errcode = '22023';
  end if;

  select * into b from public.business_billing where business_id = p_business_id for update;
  if not found then
    raise exception 'billing record not found' using errcode = 'P0002';
  end if;

  if b.stripe_subscription_id is null then
    update public.business_billing set
      sms_packs = p_new_packs,
      sms_enabled = sms_enabled and p_new_packs > 0,
      current_price_pence = public.billing_price_pence(b.staff_seats, b.billing_interval, p_new_packs),
      next_staff_seats = null, next_sms_packs = null, next_price_pence = null, change_effective_at = null
    where business_id = p_business_id;
  elsif p_new_packs > b.sms_packs then
    raise exception 'sms_increase_requires_payment';
  else
    v_next_packs := case when p_new_packs < b.sms_packs then p_new_packs end;
    v_next_seats := b.next_staff_seats;
    v_pending := v_next_seats is not null or v_next_packs is not null;
    if v_pending and coalesce(b.change_effective_at, b.current_period_end) is null then
      raise exception 'billing period is not known yet' using errcode = 'P0001';
    end if;
    update public.business_billing set
      next_sms_packs = v_next_packs,
      next_price_pence = case when v_pending then
        public.billing_price_pence(coalesce(v_next_seats, b.staff_seats), b.billing_interval, coalesce(v_next_packs, b.sms_packs)) end,
      change_effective_at = case when v_pending then coalesce(b.change_effective_at, b.current_period_end) end
    where business_id = p_business_id;
  end if;
end $$;

-- The owner switches texting on or off without changing what they pay for.
create function public.set_sms_enabled(p_business_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(p_business_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_enabled and not exists (select 1 from public.business_billing where business_id = p_business_id and sms_packs > 0) then
    raise exception 'sms_needs_a_pack: buy an SMS pack first' using errcode = 'P0001';
  end if;
  update public.business_billing set sms_enabled = p_enabled where business_id = p_business_id;
end $$;

-- 5) Planned reductions that have come due (seats and packs together).
create or replace function public.apply_due_seat_changes() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with u as (
    update public.business_billing set
      staff_seats = coalesce(next_staff_seats, staff_seats),
      sms_packs = coalesce(next_sms_packs, sms_packs),
      sms_enabled = sms_enabled and coalesce(next_sms_packs, sms_packs) > 0,
      current_price_pence = next_price_pence,
      next_staff_seats = null, next_sms_packs = null, next_price_pence = null, change_effective_at = null
    where next_price_pence is not null and change_effective_at <= now()
    returning 1)
  select count(*)::int into n from u;
  return n;
end $$;

-- 6) Stripe sync: seats and packs never go DOWN from Stripe (we schedule reductions ourselves),
--    they go up if Stripe has more (the owner added and paid).
drop function public.sync_subscription(uuid, text, text, text, timestamptz, text, int);
create function public.sync_subscription(
  p_business_id uuid, p_subscription_id text, p_customer_id text, p_status text,
  p_period_end timestamptz, p_interval text, p_quantity int, p_sms_quantity int default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.business_billing%rowtype; v_seats int; v_packs int; v_interval text;
begin
  if p_status not in ('trialing', 'active', 'past_due', 'canceled', 'unpaid') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  select * into b from public.business_billing where business_id = p_business_id for update;
  if not found then
    raise exception 'billing record not found' using errcode = 'P0002';
  end if;

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
    -- a pending reduction must stay below the (possibly raised) counts
    next_staff_seats = case when next_staff_seats < v_seats then next_staff_seats end,
    next_sms_packs = case when next_sms_packs < v_packs then next_sms_packs end
  where business_id = p_business_id;

  -- keep the "next period" price and date consistent with whatever is still pending
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
end $$;

-- 7) After the owner has paid for more seats / packs on a live subscription.
create or replace function public.apply_seat_increase(p_business_id uuid, p_new_seats int) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.business_billing%rowtype;
begin
  select * into b from public.business_billing where business_id = p_business_id for update;
  if not found or b.stripe_subscription_id is null then
    raise exception 'no subscription' using errcode = 'P0001';
  end if;
  if p_new_seats is null or p_new_seats <= b.staff_seats or p_new_seats > 50 then
    raise exception 'not an increase' using errcode = '22023';
  end if;
  update public.business_billing set
    staff_seats = p_new_seats,
    current_price_pence = public.billing_price_pence(p_new_seats, b.billing_interval, b.sms_packs),
    next_staff_seats = null,
    next_price_pence = case when next_sms_packs is null then null else
      public.billing_price_pence(p_new_seats, b.billing_interval, next_sms_packs) end,
    change_effective_at = case when next_sms_packs is null then null else change_effective_at end
  where business_id = p_business_id;
end $$;

create function public.apply_sms_increase(p_business_id uuid, p_new_packs int) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.business_billing%rowtype;
begin
  select * into b from public.business_billing where business_id = p_business_id for update;
  if not found or b.stripe_subscription_id is null then
    raise exception 'no subscription' using errcode = 'P0001';
  end if;
  if p_new_packs is null or p_new_packs <= b.sms_packs or p_new_packs > 20 then
    raise exception 'not an increase' using errcode = '22023';
  end if;
  update public.business_billing set
    sms_packs = p_new_packs,
    sms_enabled = sms_enabled or b.sms_packs = 0,   -- buying packs turns texting on
    current_price_pence = public.billing_price_pence(b.staff_seats, b.billing_interval, p_new_packs),
    next_sms_packs = null,
    next_price_pence = case when next_staff_seats is null then null else
      public.billing_price_pence(next_staff_seats, b.billing_interval, p_new_packs) end,
    change_effective_at = case when next_staff_seats is null then null else change_effective_at end
  where business_id = p_business_id;
end $$;

-- 8) Choosing packs when the business is first set up.
drop function public.create_business(text, text, text, text, text, int, text);
create function public.create_business(
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
  if p_interval is null or p_interval not in ('month', 'year') then
    raise exception 'invalid billing interval' using errcode = '22023';
  end if;
  if p_sms_packs is null or p_sms_packs < 0 or p_sms_packs > 20 then
    raise exception 'sms packs must be between 0 and 20' using errcode = '22023';
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

-- grants
revoke all on function public.billing_price_pence(int, text, int) from public, anon;
revoke all on function public.change_staff_seats(uuid, int) from public, anon;
revoke all on function public.change_sms_packs(uuid, int) from public, anon;
revoke all on function public.set_sms_enabled(uuid, boolean) from public, anon;
revoke all on function public.apply_due_seat_changes() from public, anon, authenticated;
revoke all on function public.sync_subscription(uuid, text, text, text, timestamptz, text, int, int) from public, anon, authenticated;
revoke all on function public.apply_seat_increase(uuid, int) from public, anon, authenticated;
revoke all on function public.apply_sms_increase(uuid, int) from public, anon, authenticated;
revoke all on function public.create_business(text, text, text, text, text, int, text, int) from public, anon;
grant execute on function public.billing_price_pence(int, text, int) to authenticated, service_role;
grant execute on function public.change_staff_seats(uuid, int) to authenticated;
grant execute on function public.change_sms_packs(uuid, int) to authenticated;
grant execute on function public.set_sms_enabled(uuid, boolean) to authenticated;
grant execute on function public.apply_due_seat_changes() to service_role;
grant execute on function public.sync_subscription(uuid, text, text, text, timestamptz, text, int, int) to service_role;
grant execute on function public.apply_seat_increase(uuid, int) to service_role;
grant execute on function public.apply_sms_increase(uuid, int) to service_role;
grant execute on function public.create_business(text, text, text, text, text, int, text, int) to authenticated;
