import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";

export type Agent = {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  createdAt: number;
};

export async function getAgentByUsername(username: string): Promise<Agent | undefined> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, name, username, password_hash as "passwordHash", created_at as "createdAt"
    FROM agents WHERE username = ${username.toLowerCase()}
  `;
  const row = rows[0];
  return row ? { ...row, createdAt: Number(row.createdAt) } as Agent : undefined;
}

export async function createAgent(name: string, username: string, password: string): Promise<Agent> {
  await ensureSchema();
  const id = randomUUID();
  const now = Date.now();
  const passwordHash = bcrypt.hashSync(password, 10);
  await sql`
    INSERT INTO agents (id, name, username, password_hash, created_at)
    VALUES (${id}, ${name}, ${username.toLowerCase()}, ${passwordHash}, ${now})
    ON CONFLICT (username) DO NOTHING
  `;
  return { id, name, username: username.toLowerCase(), passwordHash, createdAt: now };
}

export async function seedDefaultAgents() {
  await ensureSchema();
  const rows = await sql`SELECT COUNT(*)::int as count FROM agents`;
  if (rows[0].count === 0) {
    await createAgent("Agent 1", "agent1", "agent1pass");
    await createAgent("Agent 2", "agent2", "agent2pass");
  }
}

// how recently an agent must have polled to be considered "online" for presence purposes
export const AGENT_ONLINE_WINDOW_MS = 15_000;

export async function touchAgentSeen(agentId: string) {
  await ensureSchema();
  await sql`UPDATE agents SET last_seen_at = ${Date.now()} WHERE id = ${agentId}`;
}

export async function isAnyAgentOnline(): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`
    SELECT COUNT(*)::int as count FROM agents WHERE last_seen_at > ${Date.now() - AGENT_ONLINE_WINDOW_MS}
  `;
  return rows[0].count > 0;
}
