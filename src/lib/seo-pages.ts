/**
 * Pages written for search engines and for owners who are comparing booking tools: one per kind of business, plus a general FAQ.
 * Everything claimed here is something the product really does today. Do not add features that are not built (SMS texts, calendar sync,
 * taking the full price online, several locations...). Prices are not written here: the pages read them from the price formula.
 */
export type Faq = { q: string; a: string };

export type BusinessPage = {
  slug: string;
  label: string;
  metaTitle: string;
  description: string;
  h1: string;
  lead: string;
  problems: { title: string; text: string }[];
  example: { name: string; minutes: number; price: number; deposit?: number }[];
  exampleNote: string;
  depositText: string;
  teamText: string;
  faqs: Faq[];
};

export const BUSINESS_PAGES: BusinessPage[] = [
  {
    slug: "massage-spas",
    label: "Massage & spas",
    metaTitle: "Online booking system for massage therapists and spas",
    description: "Let clients book a massage online, any time of day. Your own booking page, deposits paid straight to your Stripe account, reminders by email. Dashboard in English or Thai. Free for 60 days.",
    h1: "Online booking for massage therapists and spas",
    lead: "Clients book a treatment, a time and a therapist from their phone, without a phone call or a message thread. You see every booking in one calendar, and your dashboard can be in English or in Thai.",
    problems: [
      { title: "Calls and messages while you are with a client", text: "Every missed call is a client who may book somewhere else. With an online booking page, people choose a free time themselves, day or night." },
      { title: "Clients who do not turn up", text: "Take a small deposit by card when they book, and set how late they can cancel for it to be refunded. The money goes straight to your own Stripe account." },
      { title: "Therapists with different hours", text: "Each therapist has their own working hours and days off. Clients pick \"Anyone\" or a person they know, and only times that are really free are shown." },
    ],
    example: [
      { name: "Thai massage, 60 minutes", minutes: 60, price: 45, deposit: 10 },
      { name: "Thai massage, 90 minutes", minutes: 90, price: 65, deposit: 10 },
      { name: "Foot reflexology, 45 minutes", minutes: 45, price: 35 },
    ],
    exampleNote: "An example of how a shop might list its treatments. You choose your own services, times and prices.",
    depositText: "A deposit of a few pounds is often enough to stop casual no-shows. You decide the amount for each treatment, and whether it is given back when the client cancels in time.",
    teamText: "Add each therapist, set the days and hours they work, and choose which treatments each person offers. If prices differ between people or levels, the client sees the right price before they book.",
    faqs: [
      { q: "Can my dashboard be in Thai?", a: "Yes. The dashboard, sign-in and set-up pages have an EN / ไทย switch at the top. Your clients' booking page and emails are in English." },
      { q: "Can clients choose a therapist?", a: "Yes. They can pick a specific person or leave it as \"Anyone\" and get the first free time. You decide who offers which treatment." },
      { q: "Do I have to take deposits?", a: "No. Deposits are optional, set per treatment. Without one, the client simply books and gets a confirmation email." },
    ],
  },
  {
    slug: "salons-beauty",
    label: "Salons & beauty",
    metaTitle: "Online booking system for hair salons, nail and beauty businesses",
    description: "Online booking for UK salons, nail bars and beauty studios. Each stylist has their own hours, clients get confirmation and reminder emails, deposits go to your own Stripe account. Flat fee, no commission.",
    h1: "Online booking for hair salons, nail bars and beauty studios",
    lead: "Give clients one link to book a treatment with the person they like, at a time that really is free. Confirmation and reminder emails go out by themselves.",
    problems: [
      { title: "Back-and-forth on Instagram and WhatsApp", text: "Put your booking link in your bio and messages. Clients choose a service, a stylist and a time without waiting for a reply." },
      { title: "Last-minute cancellations", text: "Reminders go out before the appointment, and clients can cancel online until the cut-off time you set. Your calendar frees up the slot." },
      { title: "Different prices for different people", text: "If a senior stylist costs more than a junior, set a price level for each person. The client sees the right price before they confirm." },
    ],
    example: [
      { name: "Cut and finish", minutes: 60, price: 45 },
      { name: "Gel manicure", minutes: 45, price: 30, deposit: 10 },
      { name: "Full colour", minutes: 150, price: 95, deposit: 20 },
    ],
    exampleNote: "An example of how a salon might list its services. Your services, times and prices are your own.",
    depositText: "Long or expensive appointments, like colour, are where a no-show costs most. Ask for a deposit on those and leave quick services without one.",
    teamText: "Each stylist or technician has their own working hours, days off and list of services. Buffer time before or after a service keeps the day realistic.",
    faqs: [
      { q: "Can clients book with one particular stylist?", a: "Yes. They choose a person or \"Anyone\". Only that person's free times are shown." },
      { q: "Can I block out a day or a holiday?", a: "Yes. Add days off for a person with the dates, and those days no longer offer times." },
      { q: "Does it take commission on bookings?", a: "No. You pay a flat monthly fee. Deposits go to your own Stripe account, and Stripe's normal card fees apply to them." },
    ],
  },
  {
    slug: "barbers",
    label: "Barbers",
    metaTitle: "Online booking system for barbers and barber shops",
    description: "Online booking for barber shops: short appointments, several barbers, a clear day view. Clients book from one link, reminders go out by email. Flat monthly fee, no commission.",
    h1: "Online booking for barbers and barber shops",
    lead: "Short appointments, busy days and several barbers: clients pick a barber and a time, and your day view shows who is where. No more answering the same \"are you free at 5?\" message.",
    problems: [
      { title: "Lots of short appointments", text: "Give each service its real length, such as 30 minutes for a haircut or 45 for a cut and beard trim. The booking page offers only times that fit, in 15-minute steps." },
      { title: "Walk-ins and bookings together", text: "Block time for walk-ins by giving a barber shorter working hours or a day off, and take bookings in the rest." },
      { title: "Regulars who want their barber", text: "Clients choose their barber, or \"Anyone\" for the first free chair." },
    ],
    example: [
      { name: "Haircut", minutes: 30, price: 18 },
      { name: "Haircut and beard trim", minutes: 45, price: 25 },
      { name: "Skin fade", minutes: 45, price: 22 },
    ],
    exampleNote: "An example of how a barber shop might list its services. Your services, times and prices are your own.",
    depositText: "Most barbers do not need deposits for a haircut. If you have no-show problems, add a small deposit to your longer or busier services only.",
    teamText: "Each barber has their own hours. The schedule shows the day or the week for everyone, or for one person.",
    faqs: [
      { q: "How long can an appointment be?", a: "Each service has its own length in minutes, and you can add time before or after it. Clients can choose from times in 15-minute steps." },
      { q: "What if two clients try the same time?", a: "Only one can have it. The system checks the slot as the booking is made, so double bookings cannot happen." },
      { q: "Can I see my day on my phone?", a: "Yes. The dashboard works on a phone, with the schedule for today and the month." },
    ],
  },
  {
    slug: "therapists-wellness",
    label: "Therapists & wellness",
    metaTitle: "Online booking system for therapists, physios and wellness practices",
    description: "Online appointment booking for physiotherapists, osteopaths, counsellors, nutritionists and other wellness practices in the UK. Clear cancellation rules, reminders, deposits to your own Stripe account.",
    h1: "Online booking for therapists and wellness practices",
    lead: "Clients book an appointment with you without a phone call, and see your cancellation rules before they confirm. Reminders reduce missed appointments, and your diary stays in one place.",
    problems: [
      { title: "Appointments missed or cancelled late", text: "Set how long before the appointment a client can still cancel online, and write your own deposit and cancellation policy. Clients see it before they pay or confirm." },
      { title: "Admin between sessions", text: "Confirmations and reminders are sent for you, with the appointment as a calendar file clients can add to their phone." },
      { title: "Keeping client contact details tidy", text: "A customer list holds names, emails and phone numbers. You can export or erase a client's details when they ask." },
    ],
    example: [
      { name: "Initial consultation, 60 minutes", minutes: 60, price: 70, deposit: 20 },
      { name: "Follow-up session, 45 minutes", minutes: 45, price: 55 },
      { name: "Discovery call, 15 minutes", minutes: 15, price: 0 },
    ],
    exampleNote: "An example of how a practice might list its appointments. Your services, times and prices are your own.",
    depositText: "A deposit, or a clear late-cancellation policy, protects your time. You decide the amount per service and whether it is refunded when the client cancels in time.",
    teamText: "Add each practitioner with their own hours and the services they offer.",
    faqs: [
      { q: "Is this a clinical records system?", a: "No. Get It Book handles bookings: who, what, when, and contact details. It does not store treatment notes or health records." },
      { q: "Can clients cancel online?", a: "Yes, until the cut-off time you set. After that they are asked to contact you directly." },
      { q: "How is client data handled?", a: "Your clients' details are used to manage their booking. You can export or delete a client's details. See our privacy notice for how personal data is used." },
    ],
  },
  {
    slug: "cleaners-home-services",
    label: "Cleaners & home services",
    metaTitle: "Online booking system for cleaners, window cleaners and home services",
    description: "Online booking for cleaning and home-service businesses in the UK: window cleaners, house cleaners, gardeners and more. Customers choose a service and a time, you take a deposit by card, reminders go out automatically.",
    h1: "Online booking for cleaners and home-service businesses",
    lead: "Customers choose a job, pick a time that suits them and pay a deposit by card. You get a booking with their details, and a reminder goes out before you arrive.",
    problems: [
      { title: "Quotes and times by text message", text: "List your standard jobs with a length and a price. Customers book the ones that fit, and you only talk to them about the exceptions." },
      { title: "Wasted trips", text: "A deposit paid at booking makes customers think twice before cancelling on the day. You decide the amount and the refund rule." },
      { title: "A day made of jobs, not hours", text: "Give each job a duration, and add time before or after for travel. The booking page only offers times that fit." },
    ],
    example: [
      { name: "Windows, up to 4 windows", minutes: 90, price: 60, deposit: 10 },
      { name: "House clean, 3 hours", minutes: 180, price: 90, deposit: 25 },
      { name: "Oven clean", minutes: 120, price: 70, deposit: 15 },
    ],
    exampleNote: "An example of how a cleaning business might list its jobs. Your services, times and prices are your own.",
    depositText: "Where a wasted trip costs you most, a deposit is the simplest protection. It is paid by card at booking and goes to your own Stripe account.",
    teamText: "Add each cleaner or crew with their own working days and hours. Customers can book \"Anyone\" and get the first free person.",
    faqs: [
      { q: "Can I take the whole price online?", a: "Not yet. You can take a deposit by card when the booking is made and collect the rest yourself at the job." },
      { q: "Can I describe each job?", a: "Yes. Every service has a name, an optional description, a length and a price." },
      { q: "Will customers get a confirmation?", a: "Yes, by email, with the date, time and a link to view or cancel the booking. A reminder follows before the appointment." },
    ],
  },
  {
    slug: "coaches-tutors-trainers",
    label: "Coaches, tutors & trainers",
    metaTitle: "Online booking system for coaches, tutors and personal trainers",
    description: "Online booking for coaches, tutors and personal trainers in the UK. Clients book a session from your own link, pay a deposit by card if you wish, and get reminders by email. Flat monthly fee.",
    h1: "Online booking for coaches, tutors and personal trainers",
    lead: "Share one link. Clients pick a session type and a time from your real availability, and get a confirmation and a reminder. You stop swapping messages to find a slot.",
    problems: [
      { title: "Finding a time that works", text: "Set the days and hours you teach or coach. Clients see only the times that are free, in UK time." },
      { title: "Sessions that are cancelled at the last minute", text: "Set the cancellation cut-off, and take a deposit for longer or higher-priced sessions." },
      { title: "Different kinds of session", text: "A free intro call, a one-hour lesson and a longer workshop can each have their own length and price." },
    ],
    example: [
      { name: "Free intro call, 15 minutes", minutes: 15, price: 0 },
      { name: "One-to-one lesson, 60 minutes", minutes: 60, price: 40 },
      { name: "Coaching session, 90 minutes", minutes: 90, price: 85, deposit: 20 },
    ],
    exampleNote: "An example of how a coach or tutor might list sessions. Your services, times and prices are your own.",
    depositText: "A deposit on longer sessions commits the client to the time you have set aside. It is optional and set per session type.",
    teamText: "Working alone? That is the first person on your plan. Adding colleagues later is simple: each has their own hours.",
    faqs: [
      { q: "Can I offer a free intro call?", a: "Yes. A service can be free. It is booked like any other and needs no card." },
      { q: "Does it work for online sessions?", a: "The booking page takes the date, time and contact details. You can describe in the service how the session happens, for example online or at a venue." },
      { q: "Can I use it on my own?", a: "Yes. The first person on your plan is included in the base price." },
    ],
  },
];

export const bySlug = (slug: string) => BUSINESS_PAGES.find((p) => p.slug === slug);
