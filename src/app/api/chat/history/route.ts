import { NextRequest, NextResponse } from "next/server";
import { getMessages, getTypingStatus } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const visitorId = request.nextUrl.searchParams.get("visitorId")?.trim();
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }
  const afterId = Number(request.nextUrl.searchParams.get("afterId") ?? "0") || 0;

  const [messages, typing] = await Promise.all([
    getMessages(visitorId, afterId),
    getTypingStatus(visitorId),
  ]);

  return NextResponse.json({ messages, agentTypingAt: typing.agentTypingAt });
}
