import { NextRequest, NextResponse } from "next/server";
import { STUDIO_EMAIL, verifyStudioCredentials } from "../../../../lib/auth";
import { COOKIE_NAME, createSession, SESSION_SECONDS } from "../../../../lib/session";

export async function POST(request: NextRequest) {
  if (!process.env.STUDIO_PASSWORD || !process.env.GEMINI_MASTER_KEY)
    return NextResponse.redirect(new URL("/login?error=config", request.url), 303);

  const form = await request.formData();
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");
  const requestedNext = String(form.get("next") || "/");

  if (!(await verifyStudioCredentials(email, password))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "credentials");
    if (requestedNext.startsWith("/")) loginUrl.searchParams.set("next", requestedNext);
    return NextResponse.redirect(loginUrl, 303);
  }

  const safeNext =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/";
  const response = NextResponse.redirect(new URL(safeNext, request.url), 303);
  response.cookies.set(
    COOKIE_NAME,
    await createSession(STUDIO_EMAIL),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    },
  );
  return response;
}
