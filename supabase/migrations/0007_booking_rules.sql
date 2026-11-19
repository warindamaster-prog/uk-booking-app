-- The database decides which booking changes are allowed, so no screen or API can bypass them.
--
--   confirmed        -> cancelled | no_show | completed
--   pending_payment  -> confirmed | cancelled | expired
--   no_show          -> confirmed | completed     (undo a mistake)
--   cancelled, expired, completed: final
--
-- A booking can only be marked no-show once its start time has passed, and only upcoming
-- bookings can be moved to another time or person. Moving a booking clears its reminder flag
-- so the reminder is sent again for the new time.
create function public.enforce_booking_rules() returns trigger
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
    end if;
  end if;

  if new.starts_at is distinct from old.starts_at or new.staff_id is distinct from old.staff_id then
    if old.status not in ('confirmed', 'pending_payment') or old.starts_at <= now() then
      raise exception 'invalid_booking_change: only upcoming bookings can be rescheduled' using errcode = 'P0001';
    end if;
    new.reminder_sent_at := null;
  end if;
  return new;
end $$;

create trigger bookings_rules
  before update on public.bookings
  for each row execute function public.enforce_booking_rules();
