import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { updateGame } from "@/lib/games-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.replace(/<[^>]*>/g, "").slice(0, 60);
  if (typeof body.description === "string") patch.description = body.description.replace(/<[^>]*>/g, "").slice(0, 300);
  if (typeof body.icon === "string") patch.icon = body.icon.slice(0, 8);
  if (typeof body.rewardType === "string") patch.rewardType = body.rewardType;
  if (typeof body.rewardLabel === "string") patch.rewardLabel = body.rewardLabel.slice(0, 60);
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;

  await updateGame(Number(id), patch);
  await logAudit(check.session, "game.update", id);
  return NextResponse.json({ ok: true });
}
