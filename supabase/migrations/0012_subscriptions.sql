-- Subscription billing with Stripe. These functions are called by the Stripe webhook and the
-- seat-change flow (server only). The rules about seats and prices stay in the database.

-- A Stripe account or customer can belong to only one business.
create unique index businesses_stripe_account_key
  on public.businesses (stripe_account_id) where stripe_account_id is not null;
create unique index business_billing_customer_key
  on public.business_billing (stripe_customer_id) where stripe_customer_id is not null;
create unique index business_billing_subscription_key
  on public.business_billing (stripe_subscription_id) where stripe_subscription_id is not null;

-- Brings our billing record in line with the Stripe subscription. Safe to run repeatedly and
-- in any order (webhooks can arrive out of order):
--  * status and period end follow Stripe
--  * seats never go DOWN from Stripe: a reduction is scheduled by us and applied at renewal
--  * seats go UP if Stripe has a higher quantity (the owner added seats and paid)
--  * a reduction that has come due is applied (the period has rolled over)
create function public.sync_subscription(
  p_business_id uuid, p_subscription_id text, p_customer_id text, p_status text,
  p_period_end timestamptz, p_interval text, p_quantity int
) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.business_billing%rowtype; v_seats int; v_interval text;
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

  update public.business_billing set
    stripe_subscription_id = p_subscription_id,
    stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
    status = p_status,
    current_period_end = p_period_end,
    billing_interval = v_interval,
    staff_seats = v_seats,
    current_price_pence = public.billing_price_pence(v_seats, v_interval),
    next_price_pence = case when next_staff_seats is not null then public.billing_price_pence(next_staff_seats, v_interval) end,
    -- a pending reduction must stay below the (possibly raised) seat count
    next_staff_seats = case when next_staff_seats < v_seats then next_staff_seats end,
    change_effective_at = case when next_staff_seats < v_seats then change_effective_at end
  where business_id = p_business_id;

  -- the pending reduction may have just been cleared above: keep the three columns consistent
  update public.business_billing set next_price_pence = null, change_effective_at = null
  where business_id = p_business_id and next_staff_seats is null;

  update public.business_billing set
    staff_seats = next_staff_seats, current_price_pence = next_price_pence,
    next_staff_seats = null, next_price_pence = null, change_effective_at = null
  where business_id = p_business_id and next_staff_seats is not null and change_effective_at <= now();
end $$;

-- After the owner has paid for more seats on a live subscription.
create function public.apply_seat_increase(p_business_id uuid, p_new_seats int) returns void
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
    current_price_pence = public.billing_price_pence(p_new_seats, b.billing_interval),
    next_staff_seats = null, next_price_pence = null, change_effective_at = null
  where business_id = p_business_id;
end $$;

revoke all on function public.sync_subscription(uuid, text, text, text, timestamptz, text, int) from public, anon, authenticated;
revoke all on function public.apply_seat_increase(uuid, int) from public, anon, authenticated;
grant execute on function public.sync_subscription(uuid, text, text, text, timestamptz, text, int) to service_role;
grant execute on function public.apply_seat_increase(uuid, int) to service_role;
