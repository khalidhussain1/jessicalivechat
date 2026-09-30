import { NextRequest, NextResponse } from "next/server";
import { AGENT_COOKIE, verifyAgentSessionToken } from "@/lib/agent-auth";
import { setConversationStatus, type ConversationStatus } from "@/lib/chat-db";

export const runtime = "nodejs";

const VALID_STATUSES: ConversationStatus[] = ["open", "pending", "resolved"];

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AGENT_COOKIE)?.value;
  if (!(await verifyAgentSessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  const status = typeof body?.status === "string" ? body.status : "";

  if (!visitorId || !VALID_STATUSES.includes(status as ConversationStatus)) {
    return NextResponse.json({ error: "visitorId and a valid status are required" }, { status: 400 });
  }

  await setConversationStatus(visitorId, status as ConversationStatus);
  return NextResponse.json({ ok: true });
}
