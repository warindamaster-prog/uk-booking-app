-- A shop's own front page (the page before the service list): about text, address (for the map),
-- extra information and a photo gallery. All optional; existing shops are unchanged.
alter table public.businesses
  add column about text check (about is null or char_length(about) <= 1500),
  add column address text check (address is null or char_length(address) <= 300),
  add column additional_info text check (additional_info is null or char_length(additional_info) <= 1500),
  -- Which parts the front page shows: any of cover, about, services, hours, map, info, gallery. Empty = no front page:
  -- the shop's address opens the service list directly (as before).
  add column shop_page_show text[] not null default '{}'
    check (shop_page_show <@ array['cover','about','services','hours','map','info','gallery']::text[]);

grant update (about, address, additional_info, shop_page_show) on public.businesses to authenticated;

-- Photos: the first one is the cover. Customers see them through the server (service role); only the owner can write.
create table public.shop_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.shop_photos (business_id, sort_order);

alter table public.shop_photos enable row level security;
grant select, insert, update, delete on public.shop_photos to authenticated;
create policy shop_photos_select on public.shop_photos
  for select to authenticated using (private.is_member(business_id));
create policy shop_photos_write on public.shop_photos
  for all to authenticated
  using (private.is_owner(business_id)) with check (private.is_owner(business_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-photos', 'shop-photos', true, 4194304, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy shop_photos_obj_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shop-photos' and private.is_owner_path(name));
create policy shop_photos_obj_update on storage.objects
  for update to authenticated
  using (bucket_id = 'shop-photos' and private.is_owner_path(name))
  with check (bucket_id = 'shop-photos' and private.is_owner_path(name));
create policy shop_photos_obj_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'shop-photos' and private.is_owner_path(name));
