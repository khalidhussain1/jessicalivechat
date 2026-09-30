import { NextRequest, NextResponse } from "next/server";
import { AGENT_COOKIE, verifyAgentSessionToken } from "@/lib/agent-auth";
import { getMessages, getTypingStatus, markConversationRead } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AGENT_COOKIE)?.value;
  if (!(await verifyAgentSessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visitorId = request.nextUrl.searchParams.get("visitorId")?.trim();
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }
  const afterId = Number(request.nextUrl.searchParams.get("afterId") ?? "0") || 0;

  const [messages, typing] = await Promise.all([
    getMessages(visitorId, afterId),
    getTypingStatus(visitorId),
    markConversationRead(visitorId),
  ]);

  return NextResponse.json({ messages, visitorTypingAt: typing.visitorTypingAt });
}
