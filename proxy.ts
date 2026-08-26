import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const username = process.env.STUDIO_USERNAME;
  const password = process.env.STUDIO_PASSWORD;

  if (!username || !password)
    return new NextResponse("Studio access is not configured", { status: 503 });

  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Basic ")) {
    try {
      const [candidateUser, candidatePassword] = atob(
        authorization.slice(6),
      ).split(":");
      if (candidateUser === username && candidatePassword === password)
        return NextResponse.next();
    } catch {}
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Jomla Link Studio"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"],
};
