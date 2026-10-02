import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listTags, createTag } from "@/lib/chat-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;
  return NextResponse.json({ tags: await listTags() });
}

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 30) : "";
  const color = typeof body?.color === "string" ? body.color : "#16a34a";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const tag = await createTag(name, color);
  await logAudit(check.session, "tag.create", tag.name);
  return NextResponse.json({ tag });
}
