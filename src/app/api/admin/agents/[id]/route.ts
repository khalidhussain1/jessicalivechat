import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { getAgentById, updateAgentRole, setAgentActive, type AgentRole } from "@/lib/agents-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "super_admin");
  if ("response" in check) return check.response;

  const target = await getAgentById(id);
  if (!target) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  if (target.id === check.session.id) {
    return NextResponse.json({ error: "You cannot change your own role or active status" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const validRoles: AgentRole[] = ["agent", "admin", "super_admin"];

  if (typeof body?.role === "string" && validRoles.includes(body.role as AgentRole)) {
    await updateAgentRole(id, body.role as AgentRole);
    await logAudit(check.session, "agent.role_change", target.username, { newRole: body.role });
  }
  if (typeof body?.isActive === "boolean") {
    await setAgentActive(id, body.isActive);
    await logAudit(check.session, body.isActive ? "agent.enable" : "agent.disable", target.username);
  }

  const updated = await getAgentById(id);
  return NextResponse.json({
    agent: updated && {
      id: updated.id,
      name: updated.name,
      username: updated.username,
      role: updated.role,
      isActive: updated.isActive,
    },
  });
}
