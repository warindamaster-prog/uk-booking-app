// One-off setup of the subscription prices and the VAT rate on YOUR Stripe account.
// Safe to run again: it reuses what already exists (prices are found by lookup key).
//
//   npm run stripe:setup
//
// It reads STRIPE_SECRET_KEY from .env.local (use a TEST key first) and prints the values to add to your environment. Keep these numbers in step with src/lib/pricing.ts
// (a test checks that they match).
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set. Add it to .env.local first.");
  process.exit(1);
}
// STRIPE_API_HOST/PORT only exist so the script can be tried against a local fake server.
const stripe = new Stripe(key, {
  ...(process.env.STRIPE_API_HOST ? { host: process.env.STRIPE_API_HOST, port: process.env.STRIPE_API_PORT, protocol: "http" } : {}),
  // STRIPE_USE_FETCH=1: use fetch instead of node:https, for networks where requests go through an HTTP proxy.
  ...(process.env.STRIPE_USE_FETCH ? { httpClient: Stripe.createFetchHttpClient() } : {}),
});

const PLANS = [
  // first person, each extra person (pence), per billing period
  { lookup_key: "booking_plan_monthly", interval: "month", first: 1500, extra: 200 },
  { lookup_key: "booking_plan_yearly", interval: "year", first: 15000, extra: 2000 },
];
// SMS confirmation packs: a flat price per pack (quantity = number of packs). Yearly is 12 full months.
const SMS_PLANS = [
  { lookup_key: "booking_sms_pack_monthly", interval: "month", amount: 500 },
  { lookup_key: "booking_sms_pack_yearly", interval: "year", amount: 6000 },
];
const VAT = { display_name: "VAT", percentage: 20, country: "GB" };

async function price({ lookup_key, interval, first, extra }) {
  const found = await stripe.prices.list({ lookup_keys: [lookup_key], active: true, limit: 1 });
  if (found.data[0]) return found.data[0];
  return stripe.prices.create({
    currency: "gbp",
    lookup_key,
    recurring: { interval },
    billing_scheme: "tiered",
    tiers_mode: "graduated", // the first seat costs `first`, every seat after that costs `extra`
    tiers: [{ up_to: 1, unit_amount: first }, { up_to: "inf", unit_amount: extra }],
    tax_behavior: "exclusive", // prices are before VAT
    product_data: { name: "Booking plan" },
  });
}

async function smsPrice({ lookup_key, interval, amount }) {
  const found = await stripe.prices.list({ lookup_keys: [lookup_key], active: true, limit: 1 });
  if (found.data[0]) return found.data[0];
  return stripe.prices.create({
    currency: "gbp",
    lookup_key,
    recurring: { interval },
    unit_amount: amount,
    tax_behavior: "exclusive", // before VAT
    product_data: { name: "SMS confirmations (pack of 50 texts a month)" },
  });
}

async function vatRate() {
  const rates = await stripe.taxRates.list({ active: true, limit: 100 });
  const found = rates.data.find((r) => r.display_name === VAT.display_name && r.percentage === VAT.percentage && r.inclusive === false && r.country === VAT.country);
  return found ?? stripe.taxRates.create({ ...VAT, inclusive: false, jurisdiction: "GB" });
}

const [monthly, yearly] = await Promise.all(PLANS.map(price));
const [smsMonthly, smsYearly] = await Promise.all(SMS_PLANS.map(smsPrice));
const vat = await vatRate();

console.log("\nAdd these to .env.local (and to your hosting environment):\n");
console.log(`STRIPE_PRICE_MONTHLY=${monthly.id}`);
console.log(`STRIPE_PRICE_YEARLY=${yearly.id}`);
console.log(`STRIPE_PRICE_SMS_MONTHLY=${smsMonthly.id}`);
console.log(`STRIPE_PRICE_SMS_YEARLY=${smsYearly.id}`);
console.log(`STRIPE_VAT_TAX_RATE_ID=${vat.id}`);
console.log(`\n(${/^(sk|rk)_live_/.test(key) ? "LIVE" : "test"} mode)`);
