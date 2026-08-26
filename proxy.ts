import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySession } from "./lib/session";

export async function proxy(request: NextRequest) {
  if (!process.env.STUDIO_PASSWORD || !process.env.GEMINI_MASTER_KEY)
    return new NextResponse("Studio access is not configured", { status: 503 });

  const { pathname, search } = request.nextUrl;
  // Only the brand asset used by the public login page bypasses authentication.
  if (pathname === "/jomlalink-symbol.svg") return NextResponse.next();
  if (pathname === "/login" || pathname.startsWith("/api/auth/"))
    return NextResponse.next();

  const currentToken = request.cookies.get(COOKIE_NAME)?.value;
  if (await verifySession(currentToken)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"],
};
