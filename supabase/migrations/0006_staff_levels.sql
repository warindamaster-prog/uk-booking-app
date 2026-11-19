-- Optional staff levels (e.g. Junior, Senior) with optional per-service prices.
-- A business with no levels is unaffected: every price is the service's own price.

create table public.staff_levels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);
create unique index staff_levels_name_per_business on public.staff_levels (business_id, lower(name));

alter table public.staff
  add column level_id uuid,
  add column description text check (char_length(description) <= 300),
  -- deleting a level leaves the person without a level (standard price); business_id is kept
  add foreign key (business_id, level_id)
    references public.staff_levels (business_id, id) on delete set null (level_id);
create index on public.staff (business_id, level_id);

-- Price of a service for a level. No row = the service's standard price applies.
create table public.service_level_prices (
  business_id uuid not null,
  service_id uuid not null,
  level_id uuid not null,
  price_pence int not null check (price_pence >= 0),
  primary key (service_id, level_id),
  foreign key (business_id, service_id) references public.services (business_id, id) on delete cascade,
  foreign key (business_id, level_id) references public.staff_levels (business_id, id) on delete cascade
);
create index on public.service_level_prices (business_id, level_id);

-- A level's price may never be below the (fixed) deposit of the service.
create function public.check_level_price_covers_deposit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare dep int;
begin
  select deposit_pence into dep from public.services where id = new.service_id;
  if new.price_pence < dep then
    raise exception 'level_price_below_deposit: a level price cannot be lower than the deposit';
  end if;
  return new;
end $$;

create trigger level_price_covers_deposit
  before insert or update of price_pence on public.service_level_prices
  for each row execute function public.check_level_price_covers_deposit();

create function public.check_deposit_vs_level_prices() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.service_level_prices p
             where p.service_id = new.id and p.price_pence < new.deposit_pence) then
    raise exception 'deposit_above_level_price: the deposit is higher than a level price for this service';
  end if;
  return new;
end $$;

create trigger deposit_vs_level_prices
  before update of deposit_pence on public.services
  for each row execute function public.check_deposit_vs_level_prices();

-- Atomic replace of all level prices for one service. SECURITY INVOKER: RLS decides who may.
create function public.set_service_level_prices(p_service_id uuid, p_prices jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare bid uuid;
begin
  select business_id into bid from public.services where id = p_service_id;
  if bid is null then
    raise exception 'service not found' using errcode = 'P0002';
  end if;
  delete from public.service_level_prices where service_id = p_service_id;
  insert into public.service_level_prices (business_id, service_id, level_id, price_pence)
  select bid, p_service_id, (p ->> 'level_id')::uuid, (p ->> 'price_pence')::int
  from jsonb_array_elements(p_prices) p;
end $$;

-- ---------------------------------------------------------------------------- RLS
alter table public.staff_levels enable row level security;
alter table public.service_level_prices enable row level security;
grant select, insert, update, delete on public.staff_levels, public.service_level_prices to authenticated;

create policy levels_select on public.staff_levels
  for select to authenticated using (private.is_member(business_id));
create policy levels_write on public.staff_levels
  for all to authenticated
  using (private.is_owner(business_id)) with check (private.is_owner(business_id));

create policy slp_select on public.service_level_prices
  for select to authenticated using (private.is_member(business_id));
create policy slp_write on public.service_level_prices
  for all to authenticated
  using (private.is_owner(business_id)) with check (private.is_owner(business_id));

revoke all on function public.check_level_price_covers_deposit() from public, anon, authenticated;
revoke all on function public.check_deposit_vs_level_prices() from public, anon, authenticated;
revoke all on function public.set_service_level_prices(uuid, jsonb) from public, anon;
grant execute on function public.set_service_level_prices(uuid, jsonb) to authenticated;

-- ------------------------------------------------- create_booking: price by staff level
-- Same as migration 0004 except the price snapshot comes from the assigned person's level.
create or replace function public.create_booking(
  p_business_id uuid, p_service_id uuid, p_staff_id uuid, p_starts_at timestamptz,
  p_name text, p_email text, p_phone text, p_marketing_consent boolean,
  p_cancel_token_hash bytea, p_require_deposit boolean, p_hold_minutes int default 15
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

  -- the level price if one is set for this person's level, else the standard price
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
    business_id, staff_id, service_id, customer_id, starts_at, ends_at,
    buffer_before_minutes, buffer_after_minutes, status, service_name, duration_minutes,
    price_pence, deposit_pence, deposit_status, hold_expires_at, cancel_token_hash)
  values (
    p_business_id, p_staff_id, p_service_id, cid, p_starts_at,
    p_starts_at + svc.duration_minutes * interval '1 minute',
    svc.buffer_before_minutes, svc.buffer_after_minutes, v_status, svc.name, svc.duration_minutes,
    v_price, svc.deposit_pence,
    case when v_status = 'pending_payment' then 'pending' else 'none' end,
    case when v_status = 'pending_payment' then now() + p_hold_minutes * interval '1 minute' end,
    p_cancel_token_hash)
  returning id into bid;

  return bid;
end $$;
