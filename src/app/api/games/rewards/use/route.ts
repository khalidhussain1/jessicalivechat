import { NextRequest, NextResponse } from "next/server";
import { claimRewardUse } from "@/lib/games-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  const rewardId = typeof body?.rewardId === "number" ? body.rewardId : null;
  if (!visitorId || rewardId == null) {
    return NextResponse.json({ error: "visitorId and rewardId are required" }, { status: 400 });
  }

  const used = await claimRewardUse(visitorId, rewardId);
  if (!used) {
    return NextResponse.json({ error: "Reward not available" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
