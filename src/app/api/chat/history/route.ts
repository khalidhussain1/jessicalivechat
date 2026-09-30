import { NextRequest, NextResponse } from "next/server";
import {
  getMessages,
  getPendingSentMessages,
  getTypingStatus,
  markDelivered,
  markRead,
  touchVisitorSeen,
} from "@/lib/chat-db";
import { isAnyAgentOnline } from "@/lib/agents-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const visitorId = request.nextUrl.searchParams.get("visitorId")?.trim();
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }
  const afterId = Number(request.nextUrl.searchParams.get("afterId") ?? "0") || 0;
  const visible = request.nextUrl.searchParams.get("visible") !== "false";

  await touchVisitorSeen(visitorId);
  if (visible) {
    await markRead(visitorId, "user");
  } else {
    await markDelivered(visitorId, "user");
  }

  const [messages, statusUpdates, typing, agentOnline] = await Promise.all([
    getMessages(visitorId, afterId),
    getPendingSentMessages(visitorId, "user"),
    getTypingStatus(visitorId),
    isAnyAgentOnline(),
  ]);

  return NextResponse.json({
    messages,
    statusUpdates,
    agentTypingAt: typing.agentTypingAt,
    rungAt: typing.rungAt,
    ringActive: typing.ringActive,
    agentOnline,
  });
}
