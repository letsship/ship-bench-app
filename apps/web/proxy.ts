import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

// Gate the authed console behind the dev session cookie. Unauthenticated
// visitors are bounced to /login with a `next` hint. (Next 16 renamed the
// middleware convention to "proxy".)
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/classes",
  "/bookings",
  "/members",
  "/invoices",
  "/settings",
  "/reports",
];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (needsAuth && !request.cookies.get(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/classes/:path*", "/bookings/:path*", "/members/:path*", "/invoices/:path*", "/settings/:path*", "/reports/:path*"],
};
