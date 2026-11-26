import { llmsTxt } from "@/lib/llms-txt";

export const dynamic = "force-static";

export function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getitbook.com";
  return new Response(llmsTxt(site), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
