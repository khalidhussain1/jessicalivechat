import { sql, ensureSchema } from "@/lib/db";

export type RewardType = "points" | "free_play" | "bonus" | "achievement";

export type Game = {
  id: number;
  key: string;
  title: string;
  description: string;
  icon: string;
  rewardType: RewardType;
  rewardLabel: string;
  enabled: boolean;
  sortOrder: number;
};

const GAME_FIELDS = `
  id, key, title, description, icon, reward_type as "rewardType", reward_label as "rewardLabel",
  enabled, sort_order as "sortOrder"
`;

function toGame(row: Record<string, unknown>): Game {
  return {
    id: Number(row.id),
    key: row.key as string,
    title: row.title as string,
    description: row.description as string,
    icon: row.icon as string,
    rewardType: row.rewardType as RewardType,
    rewardLabel: row.rewardLabel as string,
    enabled: row.enabled as boolean,
    sortOrder: Number(row.sortOrder),
  };
}

// seeded once so the four built-in games exist with stable keys the client
// game components rely on — admin can edit copy/reward/order/enabled afterward
const DEFAULT_GAMES: Omit<Game, "id">[] = [
  { key: "memory", title: "Memory Cards", description: "Match the pairs as fast as you can", icon: "🧩", rewardType: "points", rewardLabel: "20 points", enabled: true, sortOrder: 0 },
  { key: "guess", title: "Number Guessing", description: "Guess the number in 7 tries", icon: "🎯", rewardType: "points", rewardLabel: "15 points", enabled: true, sortOrder: 1 },
  { key: "trivia", title: "Trivia", description: "Answer today's gaming question", icon: "🧠", rewardType: "points", rewardLabel: "15 points", enabled: true, sortOrder: 2 },
  { key: "tictactoe", title: "Tic-Tac-Toe", description: "Beat the computer", icon: "❌", rewardType: "points", rewardLabel: "25 points", enabled: true, sortOrder: 3 },
];

const DEFAULT_TRIVIA_QUESTIONS: { question: string; options: string[]; correctIndex: number }[] = [
  { question: "What does 'GG' mean in gaming?", options: ["Good Game", "Great Graphics", "Go Go"], correctIndex: 0 },
  { question: "Which genre is Tetris?", options: ["Puzzle", "Shooter", "Racing"], correctIndex: 0 },
  { question: "What does 'AFK' stand for?", options: ["Away From Keyboard", "At Full Koncentration", "Attack From Killzone"], correctIndex: 0 },
];

async function seedGamesIfEmpty() {
  const rows = await sql`SELECT COUNT(*)::int as count FROM games`;
  if (rows[0].count === 0) {
    const now = Date.now();
    for (const g of DEFAULT_GAMES) {
      const inserted = await sql`
        INSERT INTO games (key, title, description, icon, reward_type, reward_label, enabled, sort_order, created_at)
        VALUES (${g.key}, ${g.title}, ${g.description}, ${g.icon}, ${g.rewardType}, ${g.rewardLabel}, ${g.enabled}, ${g.sortOrder}, ${now})
        RETURNING id
      `;
      if (g.key === "trivia") {
        const gameId = inserted[0].id;
        for (let i = 0; i < DEFAULT_TRIVIA_QUESTIONS.length; i++) {
          const q = DEFAULT_TRIVIA_QUESTIONS[i];
          await sql`
            INSERT INTO quiz_questions (game_id, question, options, correct_index, sort_order, created_at)
            VALUES (${gameId}, ${q.question}, ${JSON.stringify(q.options)}, ${q.correctIndex}, ${i}, ${now})
          `;
        }
      }
    }
  }
}

export async function listGames(): Promise<Game[]> {
  await ensureSchema();
  await seedGamesIfEmpty();
  const rows = await sql`SELECT ${sql.unsafe(GAME_FIELDS)} FROM games ORDER BY sort_order ASC, id ASC`;
  return rows.map(toGame);
}

export async function listEnabledGames(): Promise<Game[]> {
  const all = await listGames();
  return all.filter((g) => g.enabled);
}

export async function getGameByKey(key: string): Promise<Game | undefined> {
  const all = await listGames();
  return all.find((g) => g.key === key);
}

export async function updateGame(
  id: number,
  patch: Partial<{ title: string; description: string; icon: string; rewardType: RewardType; rewardLabel: string; enabled: boolean; sortOrder: number }>,
): Promise<void> {
  await ensureSchema();
  const current = (await sql`SELECT ${sql.unsafe(GAME_FIELDS)} FROM games WHERE id = ${id}`)[0];
  if (!current) return;
  const merged = { ...toGame(current), ...patch };
  await sql`
    UPDATE games SET title = ${merged.title}, description = ${merged.description}, icon = ${merged.icon},
      reward_type = ${merged.rewardType}, reward_label = ${merged.rewardLabel}, enabled = ${merged.enabled},
      sort_order = ${merged.sortOrder}
    WHERE id = ${id}
  `;
}

export type QuizQuestion = { id: number; gameId: number; question: string; options: string[]; correctIndex: number };

export async function listQuizQuestions(gameId: number): Promise<QuizQuestion[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, game_id as "gameId", question, options, correct_index as "correctIndex"
    FROM quiz_questions WHERE game_id = ${gameId} ORDER BY sort_order ASC, id ASC
  `;
  return rows.map((r) => ({ id: Number(r.id), gameId: Number(r.gameId), question: r.question, options: r.options, correctIndex: Number(r.correctIndex) }));
}

// date bucketing uses UTC so "today" is unambiguous regardless of server/client timezone
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function hasPlayedToday(visitorId: string, gameId: number): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`
    SELECT 1 FROM game_plays WHERE visitor_id = ${visitorId} AND game_id = ${gameId} AND played_date = ${todayKey()}
  `;
  return rows.length > 0;
}

export type ClaimResult = { ok: true; reward: { id: number; label: string } } | { ok: false; reason: "already_played" };

export async function claimGamePlay(visitorId: string, gameId: number, rewardType: RewardType, rewardLabel: string): Promise<ClaimResult> {
  await ensureSchema();
  const now = Date.now();
  const rewardRows = await sql`
    INSERT INTO rewards (visitor_id, type, label, source, status, created_at)
    VALUES (${visitorId}, ${rewardType}, ${rewardLabel}, 'game', 'available', ${now})
    RETURNING id
  `;
  const rewardId = rewardRows[0].id;
  try {
    await sql`
      INSERT INTO game_plays (visitor_id, game_id, played_date, reward_id, created_at)
      VALUES (${visitorId}, ${gameId}, ${todayKey()}, ${rewardId}, ${now})
    `;
    return { ok: true, reward: { id: Number(rewardId), label: rewardLabel } };
  } catch {
    // unique (visitor_id, game_id, played_date) violation — already played today;
    // roll back the reward row we speculatively created above
    await sql`DELETE FROM rewards WHERE id = ${rewardId}`;
    return { ok: false, reason: "already_played" };
  }
}

export type DailyChallenge = {
  id: number;
  title: string;
  description: string;
  rewardType: RewardType;
  rewardLabel: string;
  enabled: boolean;
};

function toChallenge(row: Record<string, unknown>): DailyChallenge {
  return {
    id: Number(row.id),
    title: row.title as string,
    description: row.description as string,
    rewardType: row.rewardType as RewardType,
    rewardLabel: row.rewardLabel as string,
    enabled: row.enabled as boolean,
  };
}

const CHALLENGE_FIELDS = `id, title, description, reward_type as "rewardType", reward_label as "rewardLabel", enabled`;

async function seedChallengeIfEmpty() {
  const rows = await sql`SELECT COUNT(*)::int as count FROM daily_challenges`;
  if (rows[0].count === 0) {
    await sql`
      INSERT INTO daily_challenges (title, description, reward_type, reward_label, enabled, created_at)
      VALUES ('Send a message to Jessica', 'Say hello in chat today to complete the challenge', 'points', '100 points', true, ${Date.now()})
    `;
  }
}

export async function listDailyChallenges(): Promise<DailyChallenge[]> {
  await ensureSchema();
  await seedChallengeIfEmpty();
  const rows = await sql`SELECT ${sql.unsafe(CHALLENGE_FIELDS)} FROM daily_challenges ORDER BY id ASC`;
  return rows.map(toChallenge);
}

export async function getActiveDailyChallenge(): Promise<DailyChallenge | undefined> {
  const all = await listDailyChallenges();
  return all.find((c) => c.enabled);
}

export async function updateDailyChallenge(
  id: number,
  patch: Partial<{ title: string; description: string; rewardType: RewardType; rewardLabel: string; enabled: boolean }>,
): Promise<void> {
  await ensureSchema();
  const current = (await sql`SELECT ${sql.unsafe(CHALLENGE_FIELDS)} FROM daily_challenges WHERE id = ${id}`)[0];
  if (!current) return;
  const merged = { ...toChallenge(current), ...patch };
  await sql`
    UPDATE daily_challenges SET title = ${merged.title}, description = ${merged.description},
      reward_type = ${merged.rewardType}, reward_label = ${merged.rewardLabel}, enabled = ${merged.enabled}
    WHERE id = ${id}
  `;
}

export async function hasCompletedChallengeToday(visitorId: string, challengeId: number): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`
    SELECT 1 FROM daily_challenge_completions
    WHERE visitor_id = ${visitorId} AND challenge_id = ${challengeId} AND challenge_date = ${todayKey()}
  `;
  return rows.length > 0;
}

export async function claimDailyChallenge(visitorId: string, challenge: DailyChallenge): Promise<ClaimResult> {
  await ensureSchema();
  const now = Date.now();
  const rewardRows = await sql`
    INSERT INTO rewards (visitor_id, type, label, source, status, created_at)
    VALUES (${visitorId}, ${challenge.rewardType}, ${challenge.rewardLabel}, 'daily_challenge', 'available', ${now})
    RETURNING id
  `;
  const rewardId = rewardRows[0].id;
  try {
    await sql`
      INSERT INTO daily_challenge_completions (visitor_id, challenge_id, challenge_date, reward_id, created_at)
      VALUES (${visitorId}, ${challenge.id}, ${todayKey()}, ${rewardId}, ${now})
    `;
    return { ok: true, reward: { id: Number(rewardId), label: challenge.rewardLabel } };
  } catch {
    await sql`DELETE FROM rewards WHERE id = ${rewardId}`;
    return { ok: false, reason: "already_played" };
  }
}

export type Reward = {
  id: number;
  type: RewardType;
  label: string;
  source: string;
  status: "available" | "pending" | "used" | "expired";
  createdAt: number;
  usedAt: number | null;
};

export async function listRewardsForVisitor(visitorId: string): Promise<Reward[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, type, label, source, status, created_at as "createdAt", used_at as "usedAt"
    FROM rewards WHERE visitor_id = ${visitorId} ORDER BY id DESC
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    type: r.type,
    label: r.label,
    source: r.source,
    status: r.status,
    createdAt: Number(r.createdAt),
    usedAt: r.usedAt != null ? Number(r.usedAt) : null,
  }));
}

export async function claimRewardUse(visitorId: string, rewardId: number): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`
    UPDATE rewards SET status = 'used', used_at = ${Date.now()}
    WHERE id = ${rewardId} AND visitor_id = ${visitorId} AND status = 'available'
    RETURNING id
  `;
  return rows.length > 0;
}
