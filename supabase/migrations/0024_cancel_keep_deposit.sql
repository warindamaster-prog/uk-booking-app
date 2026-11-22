-- A shop that keeps the deposit whenever a customer cancels (deposit_refundable = false) lets customers cancel online
-- at any time before the appointment starts: the cancellation window only matters when a refund depends on it.
-- A booking without a deposit still follows the window.
create or replace function public.customer_cancel_booking(p_token_hash bytea) returns uuid
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; win int; refundable boolean;
begin
  select * into b from public.bookings where cancel_token_hash = p_token_hash for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if b.status not in ('confirmed', 'pending_payment') then
    raise exception 'invalid_booking_transition: this booking can no longer be cancelled' using errcode = 'P0001';
  end if;

  select cancellation_window_hours, deposit_refundable into win, refundable from public.businesses where id = b.business_id;
  if b.status = 'confirmed' then
    if not refundable and b.deposit_pence > 0 then
      if now() > b.starts_at then
        raise exception 'cancellation_window_closed: the appointment has already started' using errcode = 'P0001';
      end if;
    elsif now() > b.starts_at - win * interval '1 hour' then
      raise exception 'cancellation_window_closed: online cancellation closed % hours before the start', win
        using errcode = 'P0001';
    end if;
  end if;

  update public.bookings set status = 'cancelled', cancelled_by = 'customer' where id = b.id;
  return b.id;
end $$;
