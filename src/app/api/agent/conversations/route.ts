import { NextRequest, NextResponse } from "next/server";
import { AGENT_COOKIE, verifyAgentSessionToken } from "@/lib/agent-auth";
import { listConversations, markAllUserMessagesDelivered } from "@/lib/chat-db";
import { touchAgentSeen } from "@/lib/agents-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AGENT_COOKIE)?.value;
  const session = await verifyAgentSessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await Promise.all([touchAgentSeen(session.id), markAllUserMessagesDelivered()]);
  return NextResponse.json({ conversations: await listConversations() });
}
