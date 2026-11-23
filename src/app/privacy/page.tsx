import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy notice" };

// TODO(before launch): have this notice reviewed by someone qualified in UK data protection law
// and fill in the operator's legal name and contact details.
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Privacy notice</h1>
      <p>This notice explains how your personal data is used when you book an appointment online.</p>
      <h2 className="text-lg font-semibold">Who is responsible for your data</h2>
      <p>The business you book with decides why and how your details are used (the &quot;controller&quot;). This booking service processes the data on its behalf.</p>
      <h2 className="text-lg font-semibold">What we collect and why</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your name, email address and phone number, to make and manage your booking and to contact you about it (for example confirmations, reminders and changes).</li>
        <li>Details of the booking: service, time, price and any deposit paid.</li>
      </ul>
      <p>We collect only what is needed for your booking. We do not send marketing emails unless you tick the box to say you would like them.</p>
      <h2 className="text-lg font-semibold">Payments</h2>
      <p>If a deposit is required, card payments are handled by Stripe. We do not see or store your card details.</p>
      <h2 className="text-lg font-semibold">How long we keep it</h2>
      <p>Booking records are kept while needed to run the business and meet legal and accounting duties. You can ask the business to delete your details.</p>
      <h2 className="text-lg font-semibold">Your rights</h2>
      <p>You can ask the business to give you a copy of your data, correct it, or delete it, and you can withdraw marketing consent at any time. You can also complain to the Information Commissioner&apos;s Office (ico.org.uk).</p>
      <h2 className="text-lg font-semibold">If you are a business using Get It Book</h2>
      <p>WP Precision Systems Ltd (company number 17183797, 5 Brayford Square, London E1 0SG) is the controller of your own account details: your name, email address, phone number, business details and billing information. We use them to run your account, send you service emails, take payment and meet legal and accounting duties. Card payments for your plan are handled by Stripe. We keep account details while your account is open and for up to 30 days after it closes, and invoices for as long as the law requires. You have the same rights as above and can ask us at contact@wpprecisionsystems.co.uk. See also our <a className="underline" href="/terms">Terms of Service</a>.</p>
    </main>
  );
}
