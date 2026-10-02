import { NextRequest, NextResponse } from "next/server";
import { AGENT_COOKIE, verifyAgentSessionToken, type AgentSession } from "@/lib/agent-auth";
import { ROLE_RANK, type AgentRole } from "@/lib/agents-db";

export type RoleCheckResult = { session: AgentSession } | { response: NextResponse };

// Verifies the agent's JWT cookie server-side and checks the role it carries against
// `minRole`. Role is read ONLY from the verified token — never from request body/query/headers.
export async function requireAgentRole(
  request: NextRequest,
  minRole: AgentRole,
): Promise<RoleCheckResult> {
  const token = request.cookies.get(AGENT_COOKIE)?.value;
  const session = await verifyAgentSessionToken(token);
  if (!session) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (ROLE_RANK[session.role] < ROLE_RANK[minRole]) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}
