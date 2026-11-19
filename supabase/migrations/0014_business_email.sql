-- A shop can send its customers' emails from its own mailbox (SMTP). The password is encrypted
-- by the server before it is stored; clients can never read it back (column-level grants).
create table public.business_email_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  smtp_host text not null check (char_length(smtp_host) between 3 and 253),
  smtp_port int not null check (smtp_port in (465, 587, 2525)),
  smtp_user text not null check (char_length(smtp_user) between 3 and 254),
  smtp_pass_enc text not null check (char_length(smtp_pass_enc) <= 2000),
  from_name text check (char_length(from_name) <= 100),
  verified_at timestamptz,        -- set when a test email went through
  last_error text check (char_length(last_error) <= 300),
  last_error_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.business_email_settings enable row level security;

-- The owner can see that it is set up, and its status, but never the password.
grant select (business_id, smtp_host, smtp_port, smtp_user, from_name, verified_at, last_error, last_error_at, updated_at)
  on public.business_email_settings to authenticated;
create policy email_settings_select on public.business_email_settings
  for select to authenticated using (private.is_owner(business_id));
-- No insert/update/delete for clients: the server writes with the service role after checking ownership.
