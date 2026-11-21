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

export const metadata: Metadata = {
  title: { default: "Online booking for UK businesses", template: "%s | Booking" },
  description: "Online appointment booking for UK businesses. Flat monthly fee, no commission.",
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
