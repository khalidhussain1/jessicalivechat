import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — connect a Postgres database in Vercel Storage");
}

export const sql = neon(process.env.DATABASE_URL);

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS conversations (
          visitor_id TEXT PRIMARY KEY,
          created_at BIGINT NOT NULL,
          last_message_at BIGINT NOT NULL,
          agent_read_at BIGINT NOT NULL DEFAULT 0,
          visitor_typing_at BIGINT NOT NULL DEFAULT 0,
          agent_typing_at BIGINT NOT NULL DEFAULT 0,
          rung_at BIGINT NOT NULL DEFAULT 0
        )
      `;
      await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS rung_at BIGINT NOT NULL DEFAULT 0`;

      await sql`
        CREATE TABLE IF NOT EXISTS messages (
          id BIGSERIAL PRIMARY KEY,
          visitor_id TEXT NOT NULL,
          sender TEXT NOT NULL CHECK (sender IN ('user', 'agent')),
          sender_name TEXT,
          text TEXT NOT NULL,
          image_url TEXT,
          created_at BIGINT NOT NULL,
          delivered_at BIGINT,
          read_at BIGINT
        )
      `;
      await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at BIGINT`;
      await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at BIGINT`;

      await sql`CREATE INDEX IF NOT EXISTS idx_messages_visitor ON messages (visitor_id, id)`;

      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          phone TEXT,
          password_hash TEXT,
          provider TEXT NOT NULL DEFAULT 'credentials',
          created_at BIGINT NOT NULL
        )
      `;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;

      await sql`
        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `;
    })();
  }
  return schemaReady;
}
