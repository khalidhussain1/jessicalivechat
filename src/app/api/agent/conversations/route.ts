import { NextRequest, NextResponse } from "next/server";
import { AGENT_COOKIE, verifyAgentSessionToken } from "@/lib/agent-auth";
import { listConversations, markAllUserMessagesDelivered } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AGENT_COOKIE)?.value;
  if (!(await verifyAgentSessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await markAllUserMessagesDelivered();
  return NextResponse.json({ conversations: await listConversations() });
}
