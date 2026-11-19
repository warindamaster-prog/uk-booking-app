-- 1) The shop's own message to customers (confirmation and reminder emails).
alter table public.businesses
  add column confirmation_message text check (char_length(confirmation_message) <= 1000);
grant update (confirmation_message) on public.businesses to authenticated;

-- 2) Removing a team member. Their bookings stay for the records, so the row is hidden
--    (deleted_at) rather than deleted; a removed person can never take bookings again.
alter table public.staff add column deleted_at timestamptz;
alter table public.staff add constraint staff_deleted_is_inactive check (deleted_at is null or active = false);

-- Owner only. Refused while the person still has upcoming bookings (move or cancel them first).
create function public.delete_staff(p_staff_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.staff%rowtype;
begin
  select * into s from public.staff where id = p_staff_id;
  if not found or not private.is_owner(s.business_id) then
    raise exception 'team member not found' using errcode = 'P0002';
  end if;
  if s.deleted_at is not null then
    return;
  end if;
  if exists (
    select 1 from public.bookings b
    where b.staff_id = s.id and b.business_id = s.business_id
      and b.status in ('confirmed', 'pending_payment') and b.starts_at > now()
  ) then
    raise exception 'staff_has_upcoming_bookings: move or cancel their upcoming bookings first' using errcode = 'P0001';
  end if;
  update public.staff set active = false, deleted_at = now() where id = s.id;
end $$;

revoke all on function public.delete_staff(uuid) from public, anon;
grant execute on function public.delete_staff(uuid) to authenticated;
