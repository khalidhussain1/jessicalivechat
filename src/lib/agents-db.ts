import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";

export type AgentRole = "agent" | "admin" | "super_admin";

export const ROLE_RANK: Record<AgentRole, number> = {
  agent: 0,
  admin: 1,
  super_admin: 2,
};

export type Agent = {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  role: AgentRole;
  isActive: boolean;
  createdAt: number;
  lastSeenAt: number;
};

function toAgent(row: Record<string, unknown>): Agent {
  return {
    id: row.id as string,
    name: row.name as string,
    username: row.username as string,
    passwordHash: row.passwordHash as string,
    role: row.role as AgentRole,
    isActive: row.isActive as boolean,
    createdAt: Number(row.createdAt),
    lastSeenAt: Number(row.lastSeenAt ?? 0),
  };
}

const AGENT_FIELDS = `
  id, name, username, password_hash as "passwordHash", role, is_active as "isActive",
  created_at as "createdAt", last_seen_at as "lastSeenAt"
`;

export async function getAgentByUsername(username: string): Promise<Agent | undefined> {
  await ensureSchema();
  const rows = await sql`
    SELECT ${sql.unsafe(AGENT_FIELDS)} FROM agents WHERE username = ${username.toLowerCase()}
  `;
  const row = rows[0];
  return row ? toAgent(row) : undefined;
}

export async function getAgentById(id: string): Promise<Agent | undefined> {
  await ensureSchema();
  const rows = await sql`SELECT ${sql.unsafe(AGENT_FIELDS)} FROM agents WHERE id = ${id}`;
  const row = rows[0];
  return row ? toAgent(row) : undefined;
}

export async function listAgents(): Promise<Agent[]> {
  await ensureSchema();
  const rows = await sql`SELECT ${sql.unsafe(AGENT_FIELDS)} FROM agents ORDER BY created_at ASC`;
  return rows.map(toAgent);
}

export async function createAgent(
  name: string,
  username: string,
  password: string,
  role: AgentRole = "agent",
): Promise<Agent> {
  await ensureSchema();
  const id = randomUUID();
  const now = Date.now();
  const passwordHash = bcrypt.hashSync(password, 10);
  await sql`
    INSERT INTO agents (id, name, username, password_hash, created_at, role, is_active)
    VALUES (${id}, ${name}, ${username.toLowerCase()}, ${passwordHash}, ${now}, ${role}, true)
    ON CONFLICT (username) DO NOTHING
  `;
  return {
    id,
    name,
    username: username.toLowerCase(),
    passwordHash,
    role,
    isActive: true,
    createdAt: now,
    lastSeenAt: 0,
  };
}

export async function updateAgentRole(agentId: string, role: AgentRole) {
  await ensureSchema();
  await sql`UPDATE agents SET role = ${role} WHERE id = ${agentId}`;
}

export async function setAgentActive(agentId: string, isActive: boolean) {
  await ensureSchema();
  await sql`UPDATE agents SET is_active = ${isActive} WHERE id = ${agentId}`;
}

export async function seedDefaultAgents() {
  await ensureSchema();
  const rows = await sql`SELECT COUNT(*)::int as count FROM agents`;
  if (rows[0].count === 0) {
    await createAgent("Agent 1", "agent1", "agent1pass");
    await createAgent("Agent 2", "agent2", "agent2pass");
  }
}

// guarantees exactly one super_admin exists once agents are present — run on every
// login attempt (cheap COUNT query) rather than from ensureSchema(), since on a fresh
// database ensureSchema() runs once before any agent rows exist and its result is memoized
export async function ensureSuperAdminBootstrap() {
  await ensureSchema();
  const rows = await sql`SELECT COUNT(*)::int as count FROM agents WHERE role = 'super_admin'`;
  if (rows[0].count === 0) {
    const earliest = await sql`SELECT id FROM agents ORDER BY created_at ASC LIMIT 1`;
    if (earliest[0]) {
      await sql`UPDATE agents SET role = 'super_admin' WHERE id = ${earliest[0].id}`;
    }
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
