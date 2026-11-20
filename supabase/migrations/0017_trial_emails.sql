-- When we told a shop its free trial is about to end / has ended, so each email is sent once.
-- Null = not sent yet. Written only by the server (the cron job); shops can read their own row as before.
alter table public.business_billing
  add column trial_reminder_sent_at timestamptz,
  add column trial_ended_email_sent_at timestamptz;
