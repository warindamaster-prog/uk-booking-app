-- Whether customers are shown the business's contact email and phone (in emails and on their
-- booking page). On by default; the owner can turn it off in Settings. Replies to emails always
-- go to the business's contact email (Reply-To), regardless of this setting.
alter table public.businesses add column show_contact_to_customers boolean not null default true;
grant update (show_contact_to_customers) on public.businesses to authenticated;
