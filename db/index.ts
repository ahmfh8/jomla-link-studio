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
    await sql`CREATE TABLE IF NOT EXISTS catalog_companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS catalog_companies_name_unique
      ON catalog_companies (LOWER(name))`;
    await sql`CREATE TABLE IF NOT EXISTS company_item_counters (
      company_id TEXT PRIMARY KEY REFERENCES catalog_companies(id) ON DELETE CASCADE,
      value BIGINT NOT NULL DEFAULT 1000
    )`;
    await sql`CREATE TABLE IF NOT EXISTS issued_item_numbers (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES catalog_companies(id) ON DELETE CASCADE,
      visible_number BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      UNIQUE(company_id, visible_number)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS studio_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`;
  })();
  await schemaReady;
  return sql;
}
