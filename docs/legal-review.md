# Questions for a solicitor and an accountant (before real customers pay)

Written 23 Nov 2026. Send this page as it is. Get It Book (getitbook.com) is a booking system for UK small businesses, run by WP Precision Systems Ltd.

## What the service is
- Businesses ("shops") sign up, get a free 60-day trial with no card, then pay by subscription: £15 a month for the first person and £2 for each extra person, or yearly (10 months' price), or a 3-year prepaid package (35% off the monthly price x 36, paid once, minimum 3 staff). All prices exclude 20% VAT.
- After the trial, if a shop has not paid, only its public booking page closes. The shop can still log in and see its data.
- Shops' own customers book online and can pay a deposit. Deposits go straight to the shop's own Stripe account (Stripe Connect, Standard accounts). We never hold that money. The shop decides whether a deposit is refunded when a customer cancels.
- Our customers are businesses (B2B). Their customers' names, emails and phone numbers are stored in our database (Supabase, London region).

## What the app says today
- Billing page: "Full refund within 14 days of payment: contact support." (shown for subscription payments and for the 3-year package).
- 3-year package: one payment, no automatic renewal, reminder emails 60 and 30 days before it ends, then the booking page closes until the shop pays again or switches plan.
- Privacy notice page exists at /privacy. **There is no Terms and Conditions page yet.**

## Questions for the solicitor
1. Terms and Conditions: is a short set of terms for business customers enough (service, prices, trial, cancellation, refunds, limits of liability, data protection roles)? Can you draft or review one?
2. The 14-day refund: our customers are businesses, so the Consumer Contracts Regulations 14-day cancellation right probably does not apply. Is it right to offer a 14-day full refund voluntarily? Should it apply to the 3-year package too, and what about a shop that has used the service for 13 days?
3. Monthly and yearly subscriptions: do we need specific wording on automatic renewal, how to cancel, and what happens to the data after cancelling or non-payment? How long may we keep a shop's data?
4. Free trial: any wording needed about what happens at the end of the trial (the booking page closes; data is kept)?
5. Data protection: we think we are a processor for shops' customers' data and a controller for the shops' own account data. Is that right? Do we need a data processing agreement shown at sign-up, and is the privacy notice complete? Does Supabase (data in London) and Stripe, Vercel and email providers need to be listed as sub-processors?
6. Deposits: the shop is the merchant on Stripe, not us. Is it enough to say so in the terms, and to tell shops that they are responsible for their own refund and cancellation policy shown to their customers?
7. Liability: wording for missed or late reminder emails, downtime, and lost bookings. A cap on liability for a service costing £15 a month?
8. Anything else needed to sell to UK businesses (company details in the footer, cookie notice, accessibility statement)?

## Questions for the accountant
1. VAT: we charge 20% VAT on top of all prices through Stripe. Is the VAT treatment right for a prepaid 3-year payment taken in one go (tax point, revenue recognition, deferring income over 3 years)?
2. Refunds within 14 days: how are the VAT and the Stripe fee handled on a refund (Stripe keeps its fee)?
3. Selling to customers outside the UK (not planned yet): VAT and tax implications.
4. Is anything needed in Stripe settings for invoices (VAT number, company details)?

## Accountant's answers (received 23 Nov 2026)
- 3-year plan VAT: the whole VAT is due in the VAT return for the quarter the money is received (cash accounting), not spread over 3 years. Revenue in the company accounts is recognised over 36 months; the rest is "deferred income" on the balance sheet. Example (3 staff): 19 x 36 = 684, less 35% = 444.60, plus VAT 88.92 = 533.52; recognised 12.35 a month, but the 88.92 VAT must be paid at once, so set it aside.
- Invoices over 250 pounds need a full VAT invoice with the customer's name and address.
- 14-day refund: issue a credit note, which reduces the VAT and the recognised revenue. Stripe's fee is not returned (our cost); the VAT on Stripe's fee is reclaimed as normal on Stripe's invoice.
- Customers outside the UK (not selling yet): B2B is normally outside UK VAT but keep proof they are a business; consumers in the EU may need that country's VAT registration from the first sale. Ask before selling abroad.
- Stripe settings to make: company name WP Precision Systems Ltd, VAT number GB 532 4042 30, registered address, sequential invoice numbers, prices set as exclusive of VAT, collect the customer's business name and address at checkout.
- Done in code on 23 Nov 2026: Checkout now requires the business name and address and offers a VAT number field (both the subscription and the 3-year payment); the 3-year payment already creates a Stripe invoice and prices are exclusive of VAT.
