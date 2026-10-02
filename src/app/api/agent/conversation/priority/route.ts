import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { setConversationPriority, type ConversationPriority } from "@/lib/chat-db";

export const runtime = "nodejs";

const VALID: ConversationPriority[] = ["low", "normal", "high", "urgent"];

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
  const priority = body?.priority;
  if (!visitorId || !VALID.includes(priority)) {
    return NextResponse.json({ error: "visitorId and a valid priority are required" }, { status: 400 });
  }

  await setConversationPriority(visitorId, priority);
  return NextResponse.json({ ok: true });
}
