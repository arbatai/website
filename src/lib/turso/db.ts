import "server-only";

import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let schemaInit: Promise<void> | null = null;

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function shouldRequireAuthToken(url: string): boolean {
  return url.startsWith("libsql:") || url.startsWith("https:");
}

function getClient(): Client {
  if (client) return client;
  const url = requiredEnv("TURSO_DATABASE_URL");
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (shouldRequireAuthToken(url) && !authToken) {
    throw new Error("Missing required env var: TURSO_AUTH_TOKEN");
  }
  client = createClient({ url, authToken });
  return client;
}

async function initSchema(db: Client): Promise<void> {
  // Make cascading deletes work (SQLite default is off).
  await db.execute("PRAGMA foreign_keys = ON;");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price_label TEXT NOT NULL,
      image_url TEXT NOT NULL,
      image_alt TEXT NOT NULL,
      badge_text TEXT,
      badge_variant TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);`);
}

export async function turso(): Promise<Client> {
  const db = getClient();
  if (!schemaInit) schemaInit = initSchema(db);
  await schemaInit;
  return db;
}

