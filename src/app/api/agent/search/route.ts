import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { searchMessageVisitorIds } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ visitorIds: [] });
  }
  return NextResponse.json({ visitorIds: await searchMessageVisitorIds(q) });
}
