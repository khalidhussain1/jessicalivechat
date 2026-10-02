import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getGameByKey, claimGamePlay } from "@/lib/games-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }

  const game = await getGameByKey(key);
  if (!game || !game.enabled) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // trivia answers are checked here, server-side, so the correct index is never
  // sent to the client beforehand (see /api/games/public)
  if (game.key === "trivia") {
    const questionId = typeof body?.questionId === "number" ? body.questionId : null;
    const selectedIndex = typeof body?.selectedIndex === "number" ? body.selectedIndex : null;
    if (questionId == null || selectedIndex == null) {
      return NextResponse.json({ error: "questionId and selectedIndex are required" }, { status: 400 });
    }
    const rows = await sql`SELECT correct_index as "correctIndex" FROM quiz_questions WHERE id = ${questionId} AND game_id = ${game.id}`;
    if (!rows[0]) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    if (Number(rows[0].correctIndex) !== selectedIndex) {
      return NextResponse.json({ ok: false, correct: false });
    }
  }

  const result = await claimGamePlay(visitorId, game.id, game.rewardType, game.rewardLabel);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason });
  }
  return NextResponse.json({ ok: true, correct: true, reward: result.reward });
}
