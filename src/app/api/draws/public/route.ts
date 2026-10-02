import { NextRequest, NextResponse } from "next/server";
import { getActiveDraw, hasEntered } from "@/lib/draws-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const visitorId = request.nextUrl.searchParams.get("visitorId");
  const draw = await getActiveDraw();
  if (!draw) return NextResponse.json({ draw: null });

  const entered = visitorId ? await hasEntered(draw.id, visitorId) : false;
  // never expose other entrants' visitor ids — only the winner, once drawn, and only this visitor's own entry status
  return NextResponse.json({
    draw: {
      id: draw.id,
      title: draw.title,
      description: draw.description,
      rewardLabel: draw.rewardLabel,
      entryCount: draw.entryCount,
      maxEntries: draw.maxEntries,
      status: draw.status,
      isWinner: draw.status === "drawn" && !!visitorId && draw.winnerVisitorId === visitorId,
      wasDrawn: draw.status === "drawn",
      entered,
    },
  });
}
