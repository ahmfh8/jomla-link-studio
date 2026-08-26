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

export async function POST(request: NextRequest) {
  const configuredUsername = process.env.STUDIO_USERNAME;
  const configuredPassword = process.env.STUDIO_PASSWORD;
  if (!configuredUsername || !configuredPassword)
    return NextResponse.redirect(new URL("/login?error=config", request.url), 303);

  const form = await request.formData();
  const username = String(form.get("username") || "");
  const password = String(form.get("password") || "");
  const requestedNext = String(form.get("next") || "/");

  if (username !== configuredUsername || password !== configuredPassword) {
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
    SESSION_COOKIE,
    await createSessionToken(configuredUsername, configuredPassword),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  );
  return response;
}
