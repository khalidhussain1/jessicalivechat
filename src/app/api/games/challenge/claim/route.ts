import { NextRequest, NextResponse } from "next/server";
import { getActiveDailyChallenge, claimDailyChallenge } from "@/lib/games-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }

  const challenge = await getActiveDailyChallenge();
  if (!challenge) {
    return NextResponse.json({ error: "No active challenge" }, { status: 404 });
  }

  const result = await claimDailyChallenge(visitorId, challenge);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason });
  }
  return NextResponse.json({ ok: true, reward: result.reward });
}
