-- Opening times a shop types in for its front page. null = worked out from the team's working hours (as before).
-- Otherwise a JSON array of { "weekday": 1-7 (ISO, 1 = Monday), "start": minutes, "end": minutes }; [] = closed every day.
alter table public.businesses
  add column shop_hours jsonb check (shop_hours is null or jsonb_typeof(shop_hours) = 'array');

grant update (shop_hours) on public.businesses to authenticated;
