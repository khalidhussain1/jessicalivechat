import { sql, ensureSchema } from "@/lib/db";

export type BlockedCustomer = {
  visitorId: string;
  reason: string | null;
  blockedAt: number;
  blockedBy: string | null;
};

export async function listBlockedCustomers(): Promise<BlockedCustomer[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT visitor_id as "visitorId", reason, blocked_at as "blockedAt", blocked_by as "blockedBy"
    FROM blocked_customers ORDER BY blocked_at DESC
  `;
  return rows.map((r) => ({ ...r, blockedAt: Number(r.blockedAt) }) as BlockedCustomer);
}

export async function isCustomerBlocked(visitorId: string): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`SELECT 1 FROM blocked_customers WHERE visitor_id = ${visitorId}`;
  return rows.length > 0;
}

export async function blockCustomer(visitorId: string, reason: string | null, blockedBy: string) {
  await ensureSchema();
  await sql`
    INSERT INTO blocked_customers (visitor_id, reason, blocked_at, blocked_by)
    VALUES (${visitorId}, ${reason}, ${Date.now()}, ${blockedBy})
    ON CONFLICT (visitor_id) DO UPDATE SET reason = ${reason}, blocked_at = ${Date.now()}, blocked_by = ${blockedBy}
  `;
}

export async function unblockCustomer(visitorId: string) {
  await ensureSchema();
  await sql`DELETE FROM blocked_customers WHERE visitor_id = ${visitorId}`;
}

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_MESSAGES = 10;

// simple DB-counted sliding-window limit — no in-memory state, so it works correctly
// across Vercel's stateless serverless instances without any extra infrastructure
export async function isRateLimited(visitorId: string): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`
    SELECT COUNT(*)::int as count FROM messages
    WHERE visitor_id = ${visitorId} AND sender = 'user' AND created_at > ${Date.now() - RATE_LIMIT_WINDOW_MS}
  `;
  return rows[0].count >= RATE_LIMIT_MAX_MESSAGES;
}
