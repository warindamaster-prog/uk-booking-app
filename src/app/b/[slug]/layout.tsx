import type { Metadata } from "next";

// Shops' booking pages are not listed in search engines yet (decided 21 Nov 2026: only test shops exist). Allow them here and in robots.ts when real shops want to be found.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
