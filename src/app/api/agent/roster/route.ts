import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listAgents } from "@/lib/agents-db";

export const runtime = "nodejs";

// minimal {id, name} roster for the assignment dropdown — readable by any signed-in agent,
// unlike /api/admin/agents which also exposes role/active-status and is admin+ only
export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;

  const agents = await listAgents();
  return NextResponse.json({
    agents: agents.filter((a) => a.isActive).map((a) => ({ id: a.id, name: a.name })),
  });
}
