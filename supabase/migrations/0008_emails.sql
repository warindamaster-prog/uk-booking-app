-- Emails: outbox idempotency, calendar-invite sequence, deterministic booking ids for
-- cancellation links, and customer cancellation with a configurable window.

-- Business details the owner may now edit.
grant update (owner_name, phone) on public.businesses to authenticated;

-- ------------------------------------------------------------- booking ids and ICS sequence
alter table public.bookings add column ics_sequence int not null default 0;

-- Same rules as migration 0007, plus: every reschedule or cancellation bumps ics_sequence so
-- calendar apps and the email outbox can tell the versions of a booking apart.
create or replace function public.enforce_booking_rules() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'confirmed' and new.status in ('cancelled', 'no_show', 'completed')) or
      (old.status = 'pending_payment' and new.status in ('confirmed', 'cancelled', 'expired')) or
      (old.status = 'no_show' and new.status in ('confirmed', 'completed'))
    ) then
      raise exception 'invalid_booking_transition: % to %', old.status, new.status using errcode = 'P0001';
    end if;
    if new.status = 'no_show' and old.starts_at > now() then
      raise exception 'invalid_booking_transition: a booking can only be marked no-show after it starts'
        using errcode = 'P0001';
    end if;
    if new.status = 'cancelled' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      new.ics_sequence := old.ics_sequence + 1;
    end if;
  end if;

  if new.starts_at is distinct from old.starts_at or new.staff_id is distinct from old.staff_id then
    if old.status not in ('confirmed', 'pending_payment') or old.starts_at <= now() then
      raise exception 'invalid_booking_change: only upcoming bookings can be rescheduled' using errcode = 'P0001';
    end if;
    new.reminder_sent_at := null;
    new.ics_sequence := old.ics_sequence + 1;
  end if;
  return new;
end $$;

-- create_booking now accepts the booking id, so the server can derive the customer's
-- cancellation token from it (and rebuild the link for later emails) without storing the token.
drop function public.create_booking(uuid, uuid, uuid, timestamptz, text, text, text, boolean, bytea, boolean, int);

create function public.create_booking(
  p_business_id uuid, p_service_id uuid, p_staff_id uuid, p_starts_at timestamptz,
  p_name text, p_email text, p_phone text, p_marketing_consent boolean,
  p_cancel_token_hash bytea, p_require_deposit boolean, p_hold_minutes int default 15,
  p_booking_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  svc public.services%rowtype;
  cid uuid;
  bid uuid;
  v_status text;
  v_price int;
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

  select coalesce(slp.price_pence, svc.price_pence) into v_price
  from public.staff st
  left join public.service_level_prices slp
    on slp.service_id = svc.id and slp.level_id = st.level_id
  where st.id = p_staff_id;

  if p_starts_at <= now() then
    raise exception 'start time is in the past' using errcode = 'P0001';
  end if;

  if svc.deposit_pence > 0 and not p_require_deposit then
    raise exception 'deposit payment is not available' using errcode = 'P0001';
  end if;

  update public.bookings set status = 'expired'
  where business_id = p_business_id and status = 'pending_payment' and hold_expires_at < now();

  insert into public.customers (business_id, name, email, phone, marketing_consent, marketing_consent_at)
  values (p_business_id, p_name, lower(p_email), p_phone, p_marketing_consent,
          case when p_marketing_consent then now() end)
  on conflict (business_id, lower(email)) where email is not null
  do update set
    name = excluded.name,
    phone = excluded.phone,
    marketing_consent = public.customers.marketing_consent or excluded.marketing_consent,
    marketing_consent_at = case
      when not public.customers.marketing_consent and excluded.marketing_consent then now()
      else public.customers.marketing_consent_at end
  returning id into cid;

  v_status := case when svc.deposit_pence > 0 then 'pending_payment' else 'confirmed' end;

  insert into public.bookings (
    id, business_id, staff_id, service_id, customer_id, starts_at, ends_at,
    buffer_before_minutes, buffer_after_minutes, status, service_name, duration_minutes,
    price_pence, deposit_pence, deposit_status, hold_expires_at, cancel_token_hash)
  values (
    coalesce(p_booking_id, gen_random_uuid()), p_business_id, p_staff_id, p_service_id, cid, p_starts_at,
    p_starts_at + svc.duration_minutes * interval '1 minute',
    svc.buffer_before_minutes, svc.buffer_after_minutes, v_status, svc.name, svc.duration_minutes,
    v_price, svc.deposit_pence,
    case when v_status = 'pending_payment' then 'pending' else 'none' end,
    case when v_status = 'pending_payment' then now() + p_hold_minutes * interval '1 minute' end,
    p_cancel_token_hash)
  returning id into bid;

  return bid;
end $$;

revoke all on function public.create_booking(uuid, uuid, uuid, timestamptz, text, text, text, boolean, bytea, boolean, int, uuid)
  from public, anon, authenticated;
grant execute on function public.create_booking(uuid, uuid, uuid, timestamptz, text, text, text, boolean, bytea, boolean, int, uuid)
  to service_role;

-- ------------------------------------------------------------------ notification outbox
-- One row per email actually due: unique per booking version (seq), kind and recipient,
-- so a retry or a double click can never send the same email twice.
alter table public.booking_notifications
  add column recipient text not null default 'customer' check (recipient in ('customer', 'business')),
  add column seq int not null default 0,
  add column attempts int not null default 0;
alter table public.booking_notifications drop constraint booking_notifications_booking_id_kind_channel_key;
alter table public.booking_notifications
  add constraint booking_notifications_once unique (booking_id, kind, channel, recipient, seq);
create index on public.booking_notifications (status, created_at) where status <> 'sent';

-- ------------------------------------------------- customer cancellation (token link)
-- The rule lives here: a customer may cancel online until `cancellation_window_hours`
-- before the start. Unpaid holds can always be cancelled (no money has been taken).
create function public.customer_cancel_booking(p_token_hash bytea) returns uuid
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; win int;
begin
  select * into b from public.bookings where cancel_token_hash = p_token_hash for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if b.status not in ('confirmed', 'pending_payment') then
    raise exception 'invalid_booking_transition: this booking can no longer be cancelled' using errcode = 'P0001';
  end if;

  select cancellation_window_hours into win from public.businesses where id = b.business_id;
  if b.status = 'confirmed' and now() > b.starts_at - win * interval '1 hour' then
    raise exception 'cancellation_window_closed: online cancellation closed % hours before the start', win
      using errcode = 'P0001';
  end if;

  update public.bookings set status = 'cancelled', cancelled_by = 'customer' where id = b.id;
  return b.id;
end $$;

revoke all on function public.customer_cancel_booking(bytea) from public, anon, authenticated;
grant execute on function public.customer_cancel_booking(bytea) to service_role;
