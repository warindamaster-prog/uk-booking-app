import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai"],
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getitbook.com";
const DESCRIPTION = "Online booking software for UK small businesses. Your own booking page, deposits paid straight to your Stripe account, automatic reminders. From £15 a month, no commission, free for 60 days.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Get It Book: online booking software for UK businesses", template: "%s | Get It Book" },
  description: DESCRIPTION,
  applicationName: "Get It Book",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Get It Book", locale: "en_GB", title: "Get It Book: online booking for UK businesses", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: "Get It Book: online booking for UK businesses", description: DESCRIPTION },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${notoThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><I18nProvider locale={locale}>{children}</I18nProvider></body>
    </html>
  );
}
