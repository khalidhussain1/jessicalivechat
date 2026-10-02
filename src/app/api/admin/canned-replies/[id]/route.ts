import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { updateCannedReply, deleteCannedReply } from "@/lib/content-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.text === "string") patch.text = body.text.replace(/<[^>]*>/g, "").slice(0, 1000);
  if (typeof body.category === "string") patch.category = body.category.slice(0, 40);

  await updateCannedReply(Number(id), patch);
  await logAudit(check.session, "canned_reply.update", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  await deleteCannedReply(Number(id));
  await logAudit(check.session, "canned_reply.delete", id);
  return NextResponse.json({ ok: true });
}
