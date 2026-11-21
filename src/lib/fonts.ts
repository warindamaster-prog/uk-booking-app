import { DM_Sans, DM_Serif_Display } from "next/font/google";

/** The brand fonts of the landing page, shared with the sign-in pages. English only: Thai falls back to Noto Sans Thai. */
export const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
export const serif = DM_Serif_Display({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-dm-serif" });
