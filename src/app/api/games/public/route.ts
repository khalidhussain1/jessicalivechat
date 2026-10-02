import { NextRequest, NextResponse } from "next/server";
import { listEnabledGames, getActiveDailyChallenge, hasPlayedToday, hasCompletedChallengeToday, listQuizQuestions } from "@/lib/games-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const visitorId = request.nextUrl.searchParams.get("visitorId");

  const [games, challenge] = await Promise.all([listEnabledGames(), getActiveDailyChallenge()]);

  const gamesWithStatus = await Promise.all(
    games.map(async (g) => ({
      ...g,
      playedToday: visitorId ? await hasPlayedToday(visitorId, g.id) : false,
      // never send correctIndex to the client — the answer is checked server-side
      // in the claim route instead, so it can't be read from devtools/network tab
      questions:
        g.key === "trivia"
          ? (await listQuizQuestions(g.id)).map((q) => ({ id: q.id, question: q.question, options: q.options }))
          : undefined,
    })),
  );

  const challengeWithStatus = challenge
    ? { ...challenge, completedToday: visitorId ? await hasCompletedChallengeToday(visitorId, challenge.id) : false }
    : null;

  return NextResponse.json({ games: gamesWithStatus, challenge: challengeWithStatus });
}
