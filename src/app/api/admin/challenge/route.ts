import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listDailyChallenges, updateDailyChallenge } from "@/lib/games-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;
  const challenges = await listDailyChallenges();
  return NextResponse.json({ challenge: challenges[0] ?? null });
}

export async function PATCH(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const challenges = await listDailyChallenges();
  const challenge = challenges[0];
  if (!challenge) return NextResponse.json({ error: "No challenge exists" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (typeof body?.title === "string") patch.title = body.title.replace(/<[^>]*>/g, "").slice(0, 80);
  if (typeof body?.description === "string") patch.description = body.description.replace(/<[^>]*>/g, "").slice(0, 300);
  if (typeof body?.rewardType === "string") patch.rewardType = body.rewardType;
  if (typeof body?.rewardLabel === "string") patch.rewardLabel = body.rewardLabel.slice(0, 60);
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled;

  await updateDailyChallenge(challenge.id, patch);
  await logAudit(check.session, "challenge.update", String(challenge.id));
  return NextResponse.json({ ok: true });
}
