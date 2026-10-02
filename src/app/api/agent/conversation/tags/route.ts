import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { addConversationTag, removeConversationTag } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
  const tagId = typeof body?.tagId === "number" ? body.tagId : null;
  if (!visitorId || tagId == null) {
    return NextResponse.json({ error: "visitorId and tagId are required" }, { status: 400 });
  }

  await addConversationTag(visitorId, tagId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
  const tagId = typeof body?.tagId === "number" ? body.tagId : null;
  if (!visitorId || tagId == null) {
    return NextResponse.json({ error: "visitorId and tagId are required" }, { status: 400 });
  }

  await removeConversationTag(visitorId, tagId);
  return NextResponse.json({ ok: true });
}
