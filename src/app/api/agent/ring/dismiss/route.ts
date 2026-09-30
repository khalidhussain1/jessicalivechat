import { NextRequest, NextResponse } from "next/server";
import { AGENT_COOKIE, verifyAgentSessionToken } from "@/lib/agent-auth";
import { dismissRing } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AGENT_COOKIE)?.value;
  if (!(await verifyAgentSessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : undefined;

  // omit visitorId to dismiss every currently-ringing conversation at once (global "Stop Ring")
  await dismissRing(visitorId);
  return NextResponse.json({ ok: true });
}
