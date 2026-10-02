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
          rung_at BIGINT NOT NULL DEFAULT 0,
          ring_dismissed_at BIGINT NOT NULL DEFAULT 0,
          visitor_last_seen_at BIGINT NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'open'
        )
      `;
      await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS rung_at BIGINT NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ring_dismissed_at BIGINT NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS visitor_last_seen_at BIGINT NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'`;
      await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'`;
      await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_agent_id TEXT`;
      await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ticket_no SERIAL`;

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
      await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS quick_question_id BIGINT`;
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
          created_at BIGINT NOT NULL,
          last_seen_at BIGINT NOT NULL DEFAULT 0
        )
      `;
      await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_seen_at BIGINT NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'agent'`;
      await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`;

      await sql`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at BIGINT NOT NULL,
          updated_by TEXT
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS audit_log (
          id BIGSERIAL PRIMARY KEY,
          actor_id TEXT,
          actor_name TEXT,
          actor_role TEXT,
          action TEXT NOT NULL,
          target TEXT,
          metadata JSONB,
          created_at BIGINT NOT NULL
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC)`;

      await sql`
        CREATE TABLE IF NOT EXISTS announcements (
          id BIGSERIAL PRIMARY KEY,
          text TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'info',
          enabled BOOLEAN NOT NULL DEFAULT true,
          dismissible BOOLEAN NOT NULL DEFAULT true,
          link_label TEXT,
          link_url TEXT,
          starts_at BIGINT,
          ends_at BIGINT,
          sort_order INT NOT NULL DEFAULT 0,
          created_at BIGINT NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS quick_questions (
          id BIGSERIAL PRIMARY KEY,
          icon TEXT NOT NULL DEFAULT '',
          label TEXT NOT NULL,
          message TEXT NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT true,
          sort_order INT NOT NULL DEFAULT 0,
          created_at BIGINT NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS faqs (
          id BIGSERIAL PRIMARY KEY,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT true,
          sort_order INT NOT NULL DEFAULT 0,
          created_at BIGINT NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS canned_replies (
          id BIGSERIAL PRIMARY KEY,
          category TEXT NOT NULL DEFAULT 'General',
          text TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS tags (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL DEFAULT '#16a34a',
          created_at BIGINT NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS conversation_tags (
          visitor_id TEXT NOT NULL,
          tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (visitor_id, tag_id)
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS conversation_notes (
          id BIGSERIAL PRIMARY KEY,
          visitor_id TEXT NOT NULL,
          agent_id TEXT,
          agent_name TEXT,
          text TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_conversation_notes_visitor ON conversation_notes (visitor_id, id)`;

      await sql`
        CREATE TABLE IF NOT EXISTS blocked_customers (
          visitor_id TEXT PRIMARY KEY,
          reason TEXT,
          blocked_at BIGINT NOT NULL,
          blocked_by TEXT
        )
      `;
    })();
  }
  return schemaReady;
}
