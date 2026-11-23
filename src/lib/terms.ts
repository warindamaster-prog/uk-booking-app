/** The text of the Terms of Service (page /terms). The English text is the one that applies. Keep docs/terms-draft.md in step when this changes. */
export const TERMS_UPDATED = "23 November 2026";

export type TermsSection = { h: string; p?: string[]; ul?: string[] };

export const TERMS_INTRO = [
  `These terms are an agreement between WP Precision Systems Ltd, a company registered in England and Wales with number 17183797 and VAT number GB532404230, whose registered office is at 5 Brayford Square, London E1 0SG, England ("we", "us"), and the business that signs up for Get It Book ("you", "the Business"). Get It Book is available at getitbook.com.`,
  `By creating an account or using Get It Book you agree to these terms. If you do not agree, please do not use it. Get It Book is for businesses and people acting for their trade or profession, not for consumers.`,
];

export const TERMS: TermsSection[] = [
  { h: "1. What Get It Book is", p: [
    `Get It Book is an online booking system. It gives your Business a booking page (for example your-shop.getitbook.com) where your customers can choose a service and a time, an area where you manage your services, team, hours and bookings, and emails that confirm, remind and cancel bookings. It can also take deposits from your customers (see section 7).`] },
  { h: "2. Your account", ul: [
    `You must be at least 18 and able to make a binding agreement for your Business.`,
    `Give us correct details and keep them up to date. Keep your password private. You are responsible for what happens under your account.`,
    `One person owns each account. The owner can add team members. You are responsible for what they do.`] },
  { h: "3. Free trial", p: [
    `New accounts get a free trial of 60 days. We do not ask for a card to start it. When the trial ends, if you have not subscribed, your public booking page closes so your customers can no longer book online. You can still log in and see your data, and you can subscribe at any time to open the page again.`] },
  { h: "4. Prices and payment", ul: [
    `Subscriptions are charged per person who takes bookings (a team seat): £15 a month for the first person and £2 a month for each extra person. The yearly plan costs ten times the monthly price for twelve months. The 3-year prepaid plan costs the monthly price x 36 less 35%, paid once, with a minimum of 3 people.`,
    `All prices are shown excluding VAT. VAT at the rate in force (20% at the date of these terms) is added and shown before you pay.`,
    `Payments are taken by Stripe. By paying you also accept Stripe's terms.`,
    `Monthly and yearly plans renew automatically for the same period until you cancel. We charge the card you saved. If a payment fails we will email you; if it is still unpaid after a reasonable time we may close your booking page until it is paid.`,
    `The 3-year plan is a single payment. It does not renew by itself. We email you about 60 and 30 days before it ends. When it ends, your booking page closes until you pay again or choose another plan.`,
    `We may change our prices. We will give you at least 30 days' written notice, and a change never applies to a period you have already paid for.`,
    `Optional extras (for example text message packs, if offered) are priced when you choose them.`] },
  { h: "5. Cancelling and refunds", ul: [
    `Monthly and yearly plans: you can cancel at any time from the Billing page (it opens Stripe's customer page). Cancelling stops the next renewal. You keep access until the end of the period you have paid for.`,
    `14-day refund: if you ask us in writing within 14 days of a payment for a plan, we will refund that payment in full. This is a goodwill promise in addition to your legal rights, and it applies to the first payment for a plan and to the 3-year plan.`,
    `After 14 days payments are not refundable, except where the law says otherwise, or where we have seriously failed to provide the service.`,
    `Refunds go back to the original card and may take several days to appear. Stripe's own processing fees may not be returned to us.`] },
  { h: "6. Using Get It Book properly", p: [
    `You agree not to: use it for anything unlawful; send spam or misleading messages to your customers; try to break, overload or get around the security of the service; resell it without our permission; or put in content that is unlawful, abusive or infringes someone else's rights. We may suspend an account that breaks these rules, after warning you where that is reasonable.`,
    `You are responsible for the information on your booking page (prices, services, photos, address, opening times) and for honouring the bookings you accept.`] },
  { h: "7. Deposits and payments from your customers", ul: [
    `If you turn on deposits, your customers pay them by card to your own Stripe account (we use Stripe Connect). You, not us, are the seller and the business your customer is dealing with. We never hold your customers' money.`,
    `You must connect a Stripe account and accept Stripe's terms for that. Stripe may check your identity and may refuse or close your account. We are not responsible for Stripe's decisions.`,
    `You set and show your own deposit and cancellation policy (Settings). You are responsible for it being fair, clear, lawful and consistent with the setting you choose (refund automatically, or keep the deposit). Get It Book carries out what you choose: when a customer cancels online it refunds the deposit automatically or keeps it, as you set. You can always refund a deposit yourself from the booking.`,
    `Disputes, chargebacks and refunds between you and your customers are between you and them. Stripe fees apply to your deposits under your agreement with Stripe.`] },
  { h: "8. Your customers' information and data protection", ul: [
    `You are the controller of the personal data of your customers (names, emails, phone numbers, booking details). We process it on your behalf, only to provide Get It Book, as a processor. We will keep it secure, use it only on your instructions, help you answer your customers' data requests, tell you without undue delay if we learn of a breach, and delete or return it when you ask or when your account is closed. We use these sub-processors: Supabase (database, London), Vercel (hosting), Stripe (payments) and our email provider.`,
    `You must have a lawful basis to use your customers' data, and you must show them a privacy notice. Get It Book shows a standard notice unless you give us the address of your own.`,
    `For your own account data (your name, email, billing details) we are a controller. See our Privacy Notice.`,
    `You can export your customer list from the dashboard. If you ask us, we will delete your account and its data within 30 days, except what we must keep by law (for example invoices).`] },
  { h: "9. Our service", p: [
    `We work to keep Get It Book available and secure, and we back up our data. We do not promise it will be uninterrupted or error free. Email delivery depends on other providers and can be delayed. Please do not rely on reminder emails as the only way to tell your customers about their appointments. We may change or improve the service, and will tell you in advance if a change would seriously harm you.`] },
  { h: "10. Intellectual property", p: [
    `We own Get It Book, its software and its brand. You keep ownership of your own content (logo, photos, texts) and give us permission to show it on your booking page and in emails for as long as you use the service.`] },
  { h: "11. Limits of our responsibility", ul: [
    `Nothing in these terms limits liability that cannot be limited by law, for example for death or personal injury caused by negligence, or fraud.`,
    `Otherwise we are not liable for loss of profit, loss of business or goodwill, indirect or consequential loss, or for losses caused by events outside our reasonable control (for example internet, power, Stripe or email-provider failures).`,
    `Our total liability to you for anything connected with Get It Book in any 12 months is limited to the amount you paid us in the 12 months before the event.`] },
  { h: "12. Ending the agreement", p: [
    `You can stop using Get It Book at any time. We may end or suspend your account if you seriously or repeatedly break these terms, do not pay, or if we must by law, and we will tell you why where we can. After the agreement ends your booking page closes. We keep your data for 30 days so you can ask for an export, then delete it, unless the law requires us to keep some of it.`] },
  { h: "13. Changes to these terms", p: [
    `We may update these terms. We will email the account owner at least 30 days before a material change takes effect. If you continue to use Get It Book after that date you accept the change; if you do not agree, you can cancel and ask for a refund of the unused part of any period you have paid for.`] },
  { h: "14. General", p: [
    `These terms (with the Privacy Notice and, if signed, a data processing agreement) are the whole agreement between us about Get It Book. If one part is found to be unenforceable the rest still applies. Neither of us may transfer the agreement without the other's consent, except that we may transfer it to a successor of our business. English law applies and the courts of England and Wales have jurisdiction.`] },
  { h: "15. Contact", p: [
    `Questions, refund requests and notices: contact@wpprecisionsystems.co.uk or write to 5 Brayford Square, London E1 0SG, England.`] },
];
