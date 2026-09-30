import { NextRequest, NextResponse } from "next/server";
import { AGENT_COOKIE, verifyAgentSessionToken } from "@/lib/agent-auth";
import { addMessage, markConversationRead } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AGENT_COOKIE)?.value;
  const session = await verifyAgentSessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!visitorId || !text) {
    return NextResponse.json({ error: "visitorId and text are required" }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }

  const message = await addMessage(visitorId, "agent", text, { senderName: session.name });
  await markConversationRead(visitorId);

  return NextResponse.json({ message });
}
