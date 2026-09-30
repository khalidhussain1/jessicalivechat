import { NextRequest, NextResponse } from "next/server";
import { AGENT_COOKIE, verifyAgentSessionToken } from "@/lib/agent-auth";
import { setTyping } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AGENT_COOKIE)?.value;
  const session = await verifyAgentSessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }

  await setTyping(visitorId, "agent");
  return NextResponse.json({ ok: true });
}
