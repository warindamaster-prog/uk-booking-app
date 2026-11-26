import { formatPence } from "./money";
import { PRICING } from "./pricing";
import { BUSINESS_PAGES } from "./seo-pages";

/**
 * The text of /llms.txt: a short, honest summary of Get It Book for AI assistants (the llms.txt convention).
 * Only things the product really does today. Prices come from the price formula so they never drift.
 */
export function llmsTxt(site: string): string {
  const base = formatPence(PRICING.baseMonthlyPence);
  const extra = formatPence(PRICING.extraSeatMonthlyPence);
  const threeYearOff = 100 - PRICING.threeYearPercentOfMonthly;
  const lines = [
    "# Get It Book",
    "",
    "> Get It Book is online appointment booking software for small businesses in the UK. Each business gets its own booking page, customers pick a service and a time, and the system sends confirmation and reminder emails. Businesses can take a deposit by card, paid straight into their own Stripe account. It charges a flat monthly fee and no commission on bookings.",
    "",
    "## Key facts",
    "",
    `- Price: ${base} a month (excluding VAT) for the first person who takes bookings, plus ${extra} a month for each extra person. Yearly: ${PRICING.yearlyMonthsCharged} months' price for 12 months. 3-year prepaid: ${threeYearOff}% off the monthly price, paid once, minimum ${PRICING.threeYearMinSeats} people. VAT (20%) is added.`,
    `- Free trial: ${PRICING.trialDays} days, no card needed. After the trial, if the business has not subscribed, only its public booking page closes; it can still log in.`,
    "- No commission: Get It Book does not take a share of bookings or deposits. Deposits go to the business's own Stripe account (Stripe Connect). Stripe's own card fees apply.",
    "- The business chooses its deposit and cancellation policy: refund the deposit automatically when a customer cancels in time, or keep it.",
    "- Booking page: each business gets an address like its-name.getitbook.com, with optional photos, an about text, opening times, a map and its own colour.",
    "- Emails: booking confirmations, reminders and cancellation emails, which can be sent from the business's own mailbox. Text message (SMS) reminders are not offered yet.",
    "- Built for the UK: times are UK time; prices are in pounds; a Thai-language owner dashboard is available.",
    "- Who it suits: salons and beauty, massage and spas, barbers, therapists and wellness, cleaners and home services, coaches, tutors and trainers. It is for appointments, not for selling products or taking table bookings.",
    "- Company: WP Precision Systems Ltd, registered in England and Wales, company number 17183797. Contact: contact@wpprecisionsystems.co.uk.",
    "",
    "## Pages",
    "",
    `- [Home and prices](${site}/)`,
    `- [Who it is for](${site}/for)`,
    ...BUSINESS_PAGES.map((p) => `- [${p.label}](${site}/for/${p.slug}): ${p.description}`),
    `- [Questions and answers](${site}/faq)`,
    `- [Terms of Service](${site}/terms)`,
    `- [Privacy notice](${site}/privacy)`,
    "",
  ];
  return lines.join("\n");
}
