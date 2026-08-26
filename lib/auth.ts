import { getDb } from "../db";

export const STUDIO_EMAIL = "ahmfh8@gmail.com";
const USER_ID = "owner";
const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

async function passwordHash(password: string, salt: Uint8Array) {
  const normalizedSalt = new Uint8Array(salt.byteLength);
  normalizedSalt.set(salt);
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: normalizedSalt, iterations: 150_000 },
    material,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function storedUser() {
  const sql = await getDb();
  const rows = await sql`SELECT email, password_hash, password_salt
    FROM studio_users WHERE id=${USER_ID} LIMIT 1` as Array<{
    email: string;
    password_hash: string;
    password_salt: string;
  }>;
  return rows[0] || null;
}

export async function verifyStudioCredentials(email: string, password: string) {
  if (email.trim().toLowerCase() !== STUDIO_EMAIL) return false;
  const user = await storedUser();
  if (user) {
    const candidate = await passwordHash(password, base64ToBytes(user.password_salt));
    return candidate === user.password_hash;
  }
  return password === String(process.env.STUDIO_PASSWORD || "");
}

export async function changeStudioPassword(currentPassword: string, newPassword: string) {
  if (!(await verifyStudioCredentials(STUDIO_EMAIL, currentPassword)))
    throw new Error("كلمة المرور الحالية غير صحيحة");
  if (newPassword.length < 10)
    throw new Error("كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await passwordHash(newPassword, salt);
  const sql = await getDb();
  await sql`INSERT INTO studio_users
    (id, email, password_hash, password_salt, updated_at)
    VALUES (${USER_ID}, ${STUDIO_EMAIL}, ${hash}, ${bytesToBase64(salt)}, ${Date.now()})
    ON CONFLICT (id) DO UPDATE SET
      email=EXCLUDED.email,
      password_hash=EXCLUDED.password_hash,
      password_salt=EXCLUDED.password_salt,
      updated_at=EXCLUDED.updated_at`;
}
