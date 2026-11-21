-- A shop's own words about deposits and cancellations, and whether a deposit is given back when the CUSTOMER cancels.
--   deposit_policy      free text shown to customers before they pay and in their emails (null = use the standard sentence)
--   deposit_refundable  true (the default, as before): a customer who cancels online in time gets the deposit back automatically.
--                       false: the shop keeps it; the shop can still refund a deposit by hand.
alter table public.businesses
  add column deposit_policy text check (deposit_policy is null or char_length(deposit_policy) <= 600),
  add column deposit_refundable boolean not null default true;

grant update (deposit_policy, deposit_refundable) on public.businesses to authenticated;
