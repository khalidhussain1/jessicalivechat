import { sql, ensureSchema } from "@/lib/db";

export type ProfileStats = {
  totalPoints: number;
  availableRewards: number;
  usedRewards: number;
  gamesPlayed: number;
  tasksApproved: number;
  tasksPending: number;
  challengesCompleted: number;
  drawsWon: number;
  achievements: { icon: string; label: string }[];
};

export async function getProfileStats(visitorId: string): Promise<ProfileStats> {
  await ensureSchema();

  const [pointsLabels, rewardCounts, gamesRow, tasksRows, challengeRow, drawsRow] = await Promise.all([
    sql`SELECT label FROM rewards WHERE visitor_id = ${visitorId} AND type = 'points'`,
    sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'available')::int as available,
        COUNT(*) FILTER (WHERE status = 'used')::int as used
      FROM rewards WHERE visitor_id = ${visitorId}
    `,
    sql`SELECT COUNT(DISTINCT game_id)::int as count FROM game_plays WHERE visitor_id = ${visitorId}`,
    sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending
      FROM task_submissions WHERE visitor_id = ${visitorId}
    `,
    sql`SELECT COUNT(*)::int as count FROM daily_challenge_completions WHERE visitor_id = ${visitorId}`,
    sql`SELECT COUNT(*)::int as count FROM lucky_draws WHERE winner_visitor_id = ${visitorId}`,
  ]);

  // labels are free text written by admins (e.g. "20 points") — parse the leading
  // number in JS rather than a fragile SQL regex; non-numeric labels just contribute 0
  const totalPoints = pointsLabels.reduce((sum, row) => sum + (parseInt(row.label, 10) || 0), 0);

  const stats = {
    totalPoints,
    availableRewards: Number(rewardCounts[0]?.available ?? 0),
    usedRewards: Number(rewardCounts[0]?.used ?? 0),
    gamesPlayed: Number(gamesRow[0]?.count ?? 0),
    tasksApproved: Number(tasksRows[0]?.approved ?? 0),
    tasksPending: Number(tasksRows[0]?.pending ?? 0),
    challengesCompleted: Number(challengeRow[0]?.count ?? 0),
    drawsWon: Number(drawsRow[0]?.count ?? 0),
  };

  const achievements: { icon: string; label: string }[] = [];
  if (stats.gamesPlayed > 0) achievements.push({ icon: "🎮", label: "First Game Played" });
  if (stats.gamesPlayed >= 4) achievements.push({ icon: "🕹️", label: "Game Explorer" });
  if (stats.tasksApproved > 0) achievements.push({ icon: "✅", label: "Task Master" });
  if (stats.challengesCompleted >= 3) achievements.push({ icon: "🔥", label: "On a Streak" });
  if (stats.drawsWon > 0) achievements.push({ icon: "🍀", label: "Lucky Winner" });

  return { ...stats, achievements };
}
