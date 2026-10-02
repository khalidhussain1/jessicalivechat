import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { updateAnnouncement, deleteAnnouncement } from "@/lib/content-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.text === "string") patch.text = body.text.replace(/<[^>]*>/g, "").slice(0, 500);
  if (typeof body.type === "string") patch.type = body.type;
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.dismissible === "boolean") patch.dismissible = body.dismissible;
  if (typeof body.linkLabel === "string" || body.linkLabel === null) patch.linkLabel = body.linkLabel;
  if (typeof body.linkUrl === "string" || body.linkUrl === null) patch.linkUrl = body.linkUrl;
  if (typeof body.startsAt === "number" || body.startsAt === null) patch.startsAt = body.startsAt;
  if (typeof body.endsAt === "number" || body.endsAt === null) patch.endsAt = body.endsAt;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;

  await updateAnnouncement(Number(id), patch);
  await logAudit(check.session, "announcement.update", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  await deleteAnnouncement(Number(id));
  await logAudit(check.session, "announcement.delete", id);
  return NextResponse.json({ ok: true });
}
