import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listConversations } from "@/lib/chat-db";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const RESPONSE_TIME_LOOKBACK_MS = 30 * DAY_MS;

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;

  await ensureSchema();
  const now = Date.now();
  const conversations = await listConversations();

  const totals = {
    total: conversations.length,
    open: conversations.filter((c) => c.status === "open").length,
    pending: conversations.filter((c) => c.status === "pending").length,
    resolved: conversations.filter((c) => c.status === "resolved").length,
    unreadConversations: conversations.filter((c) => c.unread).length,
    onlineCustomers: conversations.filter((c) => c.visitorOnline).length,
    activeRings: conversations.filter((c) => c.ringActive).length,
  };

  const [unreadMessagesRow, messagesTodayRow, messagesWeekRow, avgResponseRow] = await Promise.all([
    sql`
      SELECT COUNT(*)::int as count FROM messages m
      JOIN conversations c ON c.visitor_id = m.visitor_id
      WHERE m.sender = 'user' AND m.created_at > c.agent_read_at
    `,
    sql`SELECT COUNT(*)::int as count FROM messages WHERE created_at > ${now - DAY_MS}`,
    sql`SELECT COUNT(*)::int as count FROM messages WHERE created_at > ${now - WEEK_MS}`,
    sql`
      WITH pairs AS (
        SELECT m.created_at AS user_at,
          (SELECT MIN(a.created_at) FROM messages a
            WHERE a.visitor_id = m.visitor_id AND a.sender = 'agent' AND a.created_at > m.created_at) AS agent_at
        FROM messages m
        WHERE m.sender = 'user' AND m.created_at > ${now - RESPONSE_TIME_LOOKBACK_MS}
      )
      SELECT AVG(agent_at - user_at)::bigint as avg_ms FROM pairs WHERE agent_at IS NOT NULL
    `,
  ]);

  return NextResponse.json({
    ...totals,
    offlineCustomers: totals.total - totals.onlineCustomers,
    unreadMessages: unreadMessagesRow[0]?.count ?? 0,
    messagesToday: messagesTodayRow[0]?.count ?? 0,
    messagesThisWeek: messagesWeekRow[0]?.count ?? 0,
    avgResponseTimeMs: avgResponseRow[0]?.avg_ms != null ? Number(avgResponseRow[0].avg_ms) : null,
  });
}
