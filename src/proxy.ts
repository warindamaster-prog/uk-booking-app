import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routeShopHost, shopSubdomainsEnabled } from "@/lib/shop-host";

const PROTECTED = ["/dashboard", "/onboarding"];

/** Refreshes the Supabase session cookie and gates the dashboard routes. */
export async function proxy(request: NextRequest) {
  // Shop sub-domains (shop.getitbook.com): rewrite onto /b/<shop>, or redirect old and main-site addresses. Off by default.
  const route = routeShopHost({
    host: request.headers.get("host") ?? "", path: request.nextUrl.pathname, search: request.nextUrl.search,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "", enabled: shopSubdomainsEnabled() && !!process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (route.kind === "redirect") return NextResponse.redirect(route.url, 308);
  if (route.kind === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = route.path;
    return NextResponse.rewrite(url); // public pages: no session needed
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;

  if (!data?.claims && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
