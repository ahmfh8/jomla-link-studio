import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "jomla_studio_session";

async function createSessionToken(username: string, password: string) {
  const data = new TextEncoder().encode(
    `${username}\u0000${password}\u0000jomla-link-studio`,
  );
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function proxy(request: NextRequest) {
  const username = process.env.STUDIO_USERNAME;
  const password = process.env.STUDIO_PASSWORD;

  if (!username || !password)
    return new NextResponse("Studio access is not configured", { status: 503 });

  const { pathname, search } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/auth/"))
    return NextResponse.next();

  const expectedToken = await createSessionToken(username, password);
  const currentToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (currentToken === expectedToken) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"],
};
