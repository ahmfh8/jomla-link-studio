const COOKIE_NAME = "jomla_studio_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

function secret() {
  const value = process.env.GEMINI_MASTER_KEY || "";
  if (!value) throw new Error("GEMINI_MASTER_KEY is not configured");
  return value;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function signature(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
    ),
  );
}

export async function createSession(email: string) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${email}|${expires}`;
  return `${payload}|${await signature(payload)}`;
}

export async function verifySession(token?: string) {
  if (!token) return false;
  const parts = token.split("|");
  if (parts.length !== 3) return false;
  const [email, expiresText, suppliedSignature] = parts;
  const expires = Number(expiresText);
  if (!email || !Number.isFinite(expires) || expires < Date.now() / 1000)
    return false;
  const expected = await signature(`${email}|${expiresText}`);
  return suppliedSignature === expected;
}

export { COOKIE_NAME, SESSION_SECONDS };
