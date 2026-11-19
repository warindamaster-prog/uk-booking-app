-- Deposits paid through Stripe Checkout on the business's own Stripe account (Connect).
-- Everything here is server-only (service_role), called from the Stripe webhook and the
-- cancellation flows.

alter table public.bookings add column stripe_refund_id text;

-- Called when Stripe reports a completed deposit payment. Idempotent: running it twice for the
-- same session does nothing the second time.
--   'confirmed'      the held booking is now confirmed and its deposit marked paid
--   'already_paid'   a repeat of the same event
--   'needs_refund'   the money arrived but the booking is no longer live (the hold expired or it
--                    was cancelled): the deposit is recorded as paid so it can be refunded
--   'not_found'      no booking has this checkout session
create function public.apply_deposit_payment(p_session_id text, p_payment_intent text) returns text
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings where stripe_checkout_session_id = p_session_id for update;
  if not found then
    return 'not_found';
  end if;
  if b.deposit_status in ('paid', 'refunded', 'retained') then
    return 'already_paid';
  end if;

  if b.status = 'pending_payment' then
    update public.bookings set
      status = 'confirmed', deposit_status = 'paid', stripe_payment_intent_id = p_payment_intent, hold_expires_at = null
    where id = b.id;
    return 'confirmed';
  end if;

  update public.bookings set deposit_status = 'paid', stripe_payment_intent_id = p_payment_intent where id = b.id;
  return 'needs_refund';
end $$;

-- Records what happened to a paid deposit after a cancellation: refunded (with the Stripe refund
-- id) or kept by the business. Only a paid deposit can be settled, and only once.
create function public.record_deposit_outcome(p_booking_id uuid, p_outcome text, p_refund_id text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype;
begin
  if p_outcome not in ('refunded', 'retained') then
    raise exception 'invalid outcome' using errcode = '22023';
  end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if b.deposit_status = p_outcome then
    return;
  end if;
  if b.deposit_status <> 'paid' then
    raise exception 'deposit_not_paid: nothing to settle' using errcode = 'P0001';
  end if;
  update public.bookings set deposit_status = p_outcome,
    stripe_refund_id = coalesce(p_refund_id, stripe_refund_id)
  where id = b.id;
end $$;

revoke all on function public.apply_deposit_payment(text, text) from public, anon, authenticated;
revoke all on function public.record_deposit_outcome(uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_deposit_payment(text, text) to service_role;
grant execute on function public.record_deposit_outcome(uuid, text, text) to service_role;
