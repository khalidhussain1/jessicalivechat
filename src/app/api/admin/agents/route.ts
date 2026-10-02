import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listAgents, createAgent, AGENT_ONLINE_WINDOW_MS } from "@/lib/agents-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const agents = await listAgents();
  const now = Date.now();
  return NextResponse.json({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      username: a.username,
      role: a.role,
      isActive: a.isActive,
      createdAt: a.createdAt,
      online: now - a.lastSeenAt < AGENT_ONLINE_WINDOW_MS,
    })),
  });
}

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "super_admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role === "admin" || body?.role === "super_admin" ? body.role : "agent";

  if (!name || !username || password.length < 6) {
    return NextResponse.json(
      { error: "Name, username, and a password of at least 6 characters are required" },
      { status: 400 },
    );
  }

  const agent = await createAgent(name, username, password, role);
  await logAudit(check.session, "agent.create", agent.username, { role });
  return NextResponse.json({ agent: { id: agent.id, name: agent.name, username: agent.username, role: agent.role } });
}
