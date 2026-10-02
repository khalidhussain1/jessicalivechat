import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listCannedReplies, createCannedReply } from "@/lib/content-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// readable by any signed-in agent (they use these while replying); only admin+ can manage them
export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;
  return NextResponse.json({ cannedReplies: await listCannedReplies() });
}

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.replace(/<[^>]*>/g, "").slice(0, 1000) : "";
  const category = typeof body?.category === "string" ? body.category.slice(0, 40) : "General";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const reply = await createCannedReply({ category, text });
  await logAudit(check.session, "canned_reply.create", String(reply.id));
  return NextResponse.json({ cannedReply: reply });
}
