import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { AGENT_COOKIE, createAgentSessionToken } from "@/lib/agent-auth";
import { getAgentByUsername, seedDefaultAgents, ensureSuperAdminBootstrap } from "@/lib/agents-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  await seedDefaultAgents();
  await ensureSuperAdminBootstrap();

  const agent = await getAgentByUsername(username);
  if (!agent || !bcrypt.compareSync(password, agent.passwordHash)) {
    return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
  }
  if (!agent.isActive) {
    return NextResponse.json({ error: "This agent account has been disabled" }, { status: 403 });
  }

  const token = await createAgentSessionToken({
    id: agent.id,
    name: agent.name,
    username: agent.username,
    role: agent.role,
  });
  const response = NextResponse.json({
    ok: true,
    agent: { id: agent.id, name: agent.name, role: agent.role },
  });
  response.cookies.set(AGENT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
