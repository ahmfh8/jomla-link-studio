import { neon } from "@neondatabase/serverless";

type SqlClient = ReturnType<typeof neon>;

let client: SqlClient | null = null;
let schemaReady: Promise<void> | null = null;

function rawDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("DATABASE_URL is not configured on Vercel");
  client ??= neon(connectionString);
  return client;
}

export async function getDb() {
  const sql = rawDb();
  schemaReady ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS counters (
      id TEXT PRIMARY KEY,
      value BIGINT NOT NULL DEFAULT 1000
    )`;
  })();
  await schemaReady;
  return sql;
}
