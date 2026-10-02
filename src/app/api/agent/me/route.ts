import { NextRequest, NextResponse } from "next/server";
import { AGENT_COOKIE, verifyAgentSessionToken } from "@/lib/agent-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AGENT_COOKIE)?.value;
  const session = await verifyAgentSessionToken(token);
  return NextResponse.json({
    authenticated: !!session,
    agent: session ? { id: session.id, name: session.name, role: session.role } : null,
  });
}
