import { sql, ensureSchema } from "@/lib/db";
import type { AgentSession } from "@/lib/agent-auth";

export type AuditEntry = {
  id: number;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  target: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
};

export async function logAudit(
  actor: AgentSession,
  action: string,
  target?: string,
  metadata?: Record<string, unknown>,
) {
  await ensureSchema();
  await sql`
    INSERT INTO audit_log (actor_id, actor_name, actor_role, action, target, metadata, created_at)
    VALUES (${actor.id}, ${actor.name}, ${actor.role}, ${action}, ${target ?? null},
            ${metadata ? JSON.stringify(metadata) : null}, ${Date.now()})
  `;
}

export async function listAuditLog(limit = 200): Promise<AuditEntry[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, actor_id as "actorId", actor_name as "actorName", actor_role as "actorRole",
           action, target, metadata, created_at as "createdAt"
    FROM audit_log ORDER BY id DESC LIMIT ${limit}
  `;
  return rows.map((row) => ({
    id: Number(row.id),
    actorId: row.actorId as string | null,
    actorName: row.actorName as string | null,
    actorRole: row.actorRole as string | null,
    action: row.action as string,
    target: row.target as string | null,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: Number(row.createdAt),
  }));
}
