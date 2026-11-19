-- Customer privacy tools for the business owner (UK GDPR): erase a customer's personal data
-- and record a withdrawal of marketing consent. Export is done in the app from the same data.

-- "Delete" = anonymise. The booking rows stay (service, time, price) for the business's
-- accounting records, but nothing identifies the person any more.
--  * name, email, phone are removed; marketing consent is cleared
--  * the customer's private booking links stop working
--  * email error messages in the outbox (which can contain addresses) are scrubbed
-- Refused while the customer still has upcoming bookings: cancel those first.
create function public.anonymise_customer(p_customer_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.customers%rowtype;
begin
  select * into c from public.customers where id = p_customer_id;
  -- same answer for "doesn't exist" and "not yours", so ids can't be probed
  if not found or not private.is_owner(c.business_id) then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  if c.anonymised_at is not null then
    return;
  end if;

  if exists (
    select 1 from public.bookings b
    where b.customer_id = c.id and b.business_id = c.business_id
      and b.status in ('confirmed', 'pending_payment') and b.starts_at > now()
  ) then
    raise exception 'customer_has_upcoming_bookings: cancel their upcoming bookings first' using errcode = 'P0001';
  end if;

  update public.customers set
    name = 'Deleted customer', email = null, phone = null,
    marketing_consent = false, marketing_consent_at = null, anonymised_at = now()
  where id = c.id;

  update public.bookings set cancel_token_hash = sha256(convert_to(gen_random_uuid()::text, 'utf8'))
  where customer_id = c.id and business_id = c.business_id;

  update public.booking_notifications set error = null
  where business_id = c.business_id
    and booking_id in (select id from public.bookings where customer_id = c.id and business_id = c.business_id);
end $$;

-- Recording that a customer withdrew consent to marketing (PECR). Owner only.
create function public.withdraw_marketing_consent(p_customer_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare bid uuid;
begin
  select business_id into bid from public.customers where id = p_customer_id;
  if bid is null or not private.is_owner(bid) then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  update public.customers set marketing_consent = false, marketing_consent_at = null where id = p_customer_id;
end $$;

revoke all on function public.anonymise_customer(uuid) from public, anon;
revoke all on function public.withdraw_marketing_consent(uuid) from public, anon;
grant execute on function public.anonymise_customer(uuid) to authenticated;
grant execute on function public.withdraw_marketing_consent(uuid) to authenticated;
