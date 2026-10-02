import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { sql, ensureSchema } from "@/lib/db";
import { getMostCommonQuickQuestions, getMostActiveHours } from "@/lib/content-db";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  await ensureSchema();
  const now = Date.now();

  const [conversationsTodayRow, conversationsWeekRow, mostCommonQuickQuestions, mostActiveHours] = await Promise.all([
    sql`SELECT COUNT(DISTINCT visitor_id)::int as count FROM messages WHERE created_at > ${now - DAY_MS}`,
    sql`SELECT COUNT(DISTINCT visitor_id)::int as count FROM messages WHERE created_at > ${now - WEEK_MS}`,
    getMostCommonQuickQuestions(),
    getMostActiveHours(),
  ]);

  return NextResponse.json({
    conversationsToday: conversationsTodayRow[0]?.count ?? 0,
    conversationsThisWeek: conversationsWeekRow[0]?.count ?? 0,
    mostCommonQuickQuestions,
    mostActiveHours,
  });
}
