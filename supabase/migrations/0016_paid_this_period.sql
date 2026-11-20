-- How much (before VAT) the shop has actually paid for the current billing period: the subscription invoice
-- plus anything added part-way through (extra people, SMS packs). Shown on the Billing page.
alter table public.business_billing add column paid_this_period_pence int not null default 0 check (paid_this_period_pence >= 0);

-- Shops already on a live subscription: their paid amount so far is at least the current plan price.
update public.business_billing set paid_this_period_pence = current_price_pence
where stripe_subscription_id is not null and status = 'active';

-- A new billing period (first sync, a different subscription, or a renewal that moved the period end forward)
-- starts again from the plan price. Webhooks can arrive twice or out of order: only a LATER period end counts.
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

-- After the owner has paid for more seats / packs: the amount charged (before VAT) is added to what has been paid.
drop function public.apply_seat_increase(uuid, int);
create function public.apply_seat_increase(p_business_id uuid, p_new_seats int, p_amount_pence int default 0) returns void
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
    paid_this_period_pence = paid_this_period_pence + greatest(0, coalesce(p_amount_pence, 0)),
    next_staff_seats = null,
    next_price_pence = case when next_sms_packs is null then null else
      public.billing_price_pence(p_new_seats, b.billing_interval, next_sms_packs) end,
    change_effective_at = case when next_sms_packs is null then null else change_effective_at end
  where business_id = p_business_id;
end $$;

drop function public.apply_sms_increase(uuid, int);
create function public.apply_sms_increase(p_business_id uuid, p_new_packs int, p_amount_pence int default 0) returns void
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
    sms_enabled = sms_enabled or b.sms_packs = 0,
    current_price_pence = public.billing_price_pence(b.staff_seats, b.billing_interval, p_new_packs),
    paid_this_period_pence = paid_this_period_pence + greatest(0, coalesce(p_amount_pence, 0)),
    next_sms_packs = null,
    next_price_pence = case when next_staff_seats is null then null else
      public.billing_price_pence(next_staff_seats, b.billing_interval, p_new_packs) end,
    change_effective_at = case when next_staff_seats is null then null else change_effective_at end
  where business_id = p_business_id;
end $$;

revoke all on function public.apply_seat_increase(uuid, int, int) from public, anon, authenticated;
revoke all on function public.apply_sms_increase(uuid, int, int) from public, anon, authenticated;
grant execute on function public.apply_seat_increase(uuid, int, int) to service_role;
grant execute on function public.apply_sms_increase(uuid, int, int) to service_role;
