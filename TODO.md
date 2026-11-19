# TODO (later, outside MVP scope)

- Owner-created bookings from the dashboard (phone and walk-in bookings)
- SMS reminders (provider interface is designed; Twilio implementation not built)
- Multiple locations per business
- Recurring bookings and memberships
- Customer accounts and booking history
- Marketing email campaigns (consent is stored; sending is not built)
- Business settings page for logo replacement, slug change, opening-hours overrides
- Staff login invites (schema, RLS and the staff dashboard view are built; the invite email and set-password flow are not)
- Deleting services and staff (they can be hidden or set to not take bookings; deletion is blocked by history)
- Partial-day time off (days off are whole days in UK time)
- Privacy notice at /privacy is a plain-language draft; have it reviewed for UK GDPR and add the operator's details before launch
- Per-business privacy notice URL setting (the column exists; there is no settings screen yet)
- Rate limiting covers booking submissions only; page views are not limited
- Scheduled clean-up of expired unpaid holds (they already stop blocking slots and are marked expired on the next booking; a cron comes with the Stripe step)
