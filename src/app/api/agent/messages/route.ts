import { NextRequest, NextResponse } from "next/server";
import { AGENT_COOKIE, verifyAgentSessionToken } from "@/lib/agent-auth";
import {
  getMessages,
  getPendingSentMessages,
  getTypingStatus,
  markConversationRead,
  markDelivered,
  markRead,
} from "@/lib/chat-db";
import { touchAgentSeen } from "@/lib/agents-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AGENT_COOKIE)?.value;
  const session = await verifyAgentSessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visitorId = request.nextUrl.searchParams.get("visitorId")?.trim();
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }
  const afterId = Number(request.nextUrl.searchParams.get("afterId") ?? "0") || 0;
  const visible = request.nextUrl.searchParams.get("visible") !== "false";

  await touchAgentSeen(session.id);
  if (visible) {
    await Promise.all([markRead(visitorId, "agent"), markConversationRead(visitorId)]);
  } else {
    await markDelivered(visitorId, "agent");
  }

  const [messages, statusUpdates, typing] = await Promise.all([
    getMessages(visitorId, afterId),
    getPendingSentMessages(visitorId, "agent"),
    getTypingStatus(visitorId),
  ]);

  return NextResponse.json({ messages, statusUpdates, visitorTypingAt: typing.visitorTypingAt });
}
