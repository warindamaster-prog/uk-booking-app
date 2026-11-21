import { ImageResponse } from "next/og";

export const alt = "Get It Book: online booking for UK businesses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The picture shown when the link is shared (WhatsApp, Facebook, LinkedIn, Google). */
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 90, background: "#fafbf7", color: "#24392e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 96, height: 96, borderRadius: 24, background: "#34553e", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="#e9f2d9" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="3.5" /><path d="M7.5 3v4m9-4v4M3 10.5h18" /><path d="m8.6 15.6 2.3 2.3 4.6-4.7" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 72, letterSpacing: -2 }}><b>Get It</b><span style={{ marginLeft: 18, color: "#6a815c", fontStyle: "italic" }}>Book</span></div>
        </div>
        <div style={{ marginTop: 56, fontSize: 64, lineHeight: 1.1, letterSpacing: -2, maxWidth: 940 }}>Online booking for UK businesses. Make booking the easy part.</div>
        <div style={{ marginTop: 36, fontSize: 32, color: "#54604c" }}>Flat monthly fee · No commission · Free for 60 days</div>
      </div>
    ),
    size,
  );
}
