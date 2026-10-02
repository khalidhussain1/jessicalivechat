import { randomInt } from "crypto";
import { sql, ensureSchema } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AgentSession } from "@/lib/agent-auth";

export type DrawStatus = "open" | "closed" | "drawn";

export type LuckyDraw = {
  id: number;
  title: string;
  description: string;
  rewardLabel: string;
  maxEntries: number | null;
  startsAt: number | null;
  endsAt: number | null;
  status: DrawStatus;
  winnerVisitorId: string | null;
  drawnAt: number | null;
  entryCount: number;
};

const DRAW_FIELDS = `
  d.id, d.title, d.description, d.reward_label as "rewardLabel", d.max_entries as "maxEntries",
  d.starts_at as "startsAt", d.ends_at as "endsAt", d.status, d.winner_visitor_id as "winnerVisitorId",
  d.drawn_at as "drawnAt", COALESCE(e.entry_count, 0)::int as "entryCount"
`;

function toDraw(row: Record<string, unknown>): LuckyDraw {
  return {
    id: Number(row.id),
    title: row.title as string,
    description: row.description as string,
    rewardLabel: row.rewardLabel as string,
    maxEntries: row.maxEntries != null ? Number(row.maxEntries) : null,
    startsAt: row.startsAt != null ? Number(row.startsAt) : null,
    endsAt: row.endsAt != null ? Number(row.endsAt) : null,
    status: row.status as DrawStatus,
    winnerVisitorId: row.winnerVisitorId as string | null,
    drawnAt: row.drawnAt != null ? Number(row.drawnAt) : null,
    entryCount: Number(row.entryCount),
  };
}

async function withEntryCounts(whereClause: ReturnType<typeof sql>) {
  const rows = await sql`
    SELECT ${sql.unsafe(DRAW_FIELDS)}
    FROM lucky_draws d
    LEFT JOIN (SELECT draw_id, COUNT(*) as entry_count FROM lucky_draw_entries GROUP BY draw_id) e ON e.draw_id = d.id
    ${whereClause}
    ORDER BY d.id DESC
  `;
  return rows.map(toDraw);
}

export async function listDraws(): Promise<LuckyDraw[]> {
  await ensureSchema();
  return withEntryCounts(sql``);
}

// the one draw customers currently see — the most recent open one, or (if none open)
// the most recently drawn one, so a winner announcement stays visible after drawing
export async function getActiveDraw(): Promise<LuckyDraw | undefined> {
  await ensureSchema();
  const open = await withEntryCounts(sql`WHERE d.status = 'open'`);
  if (open[0]) return open[0];
  const drawn = await withEntryCounts(sql`WHERE d.status = 'drawn'`);
  return drawn[0];
}

export async function createDraw(input: {
  title: string;
  description: string;
  rewardLabel: string;
  maxEntries: number | null;
  startsAt: number | null;
  endsAt: number | null;
}): Promise<LuckyDraw> {
  await ensureSchema();
  const now = Date.now();
  const rows = await sql`
    INSERT INTO lucky_draws (title, description, reward_label, max_entries, starts_at, ends_at, status, created_at)
    VALUES (${input.title}, ${input.description}, ${input.rewardLabel}, ${input.maxEntries}, ${input.startsAt}, ${input.endsAt}, 'open', ${now})
    RETURNING id
  `;
  const draws = await withEntryCounts(sql`WHERE d.id = ${rows[0].id}`);
  return draws[0];
}

export async function closeDraw(id: number): Promise<void> {
  await ensureSchema();
  await sql`UPDATE lucky_draws SET status = 'closed' WHERE id = ${id} AND status = 'open'`;
}

export async function reopenDraw(id: number): Promise<void> {
  await ensureSchema();
  await sql`UPDATE lucky_draws SET status = 'open' WHERE id = ${id} AND status = 'closed'`;
}

export async function hasEntered(drawId: number, visitorId: string): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`SELECT 1 FROM lucky_draw_entries WHERE draw_id = ${drawId} AND visitor_id = ${visitorId}`;
  return rows.length > 0;
}

export type EnterResult = { ok: true } | { ok: false; reason: "not_open" | "full" };

export async function enterDraw(drawId: number, visitorId: string): Promise<EnterResult> {
  await ensureSchema();
  const draws = await withEntryCounts(sql`WHERE d.id = ${drawId}`);
  const draw = draws[0];
  if (!draw || draw.status !== "open") return { ok: false, reason: "not_open" };
  if (draw.maxEntries != null && draw.entryCount >= draw.maxEntries) return { ok: false, reason: "full" };

  await sql`
    INSERT INTO lucky_draw_entries (draw_id, visitor_id, created_at)
    VALUES (${drawId}, ${visitorId}, ${Date.now()})
    ON CONFLICT (draw_id, visitor_id) DO NOTHING
  `;
  return { ok: true };
}

export type DrawWinnerResult = { ok: true; winnerVisitorId: string } | { ok: false; reason: "no_entries" | "already_drawn" };

// server-side random selection via crypto.randomInt over the full, stored entrant
// list — transparent and auditable (every entry + the draw timestamp are kept), and
// a draw can only ever be drawn once (status flips to 'drawn' and stays there)
export async function drawWinner(drawId: number, actor: AgentSession): Promise<DrawWinnerResult> {
  await ensureSchema();
  const draws = await sql`SELECT status, reward_label as "rewardLabel" FROM lucky_draws WHERE id = ${drawId}`;
  if (!draws[0] || draws[0].status === "drawn") {
    return { ok: false, reason: "already_drawn" };
  }

  const entries = await sql`SELECT visitor_id as "visitorId" FROM lucky_draw_entries WHERE draw_id = ${drawId} ORDER BY id ASC`;
  if (entries.length === 0) return { ok: false, reason: "no_entries" };

  const winnerIndex = randomInt(entries.length);
  const winnerVisitorId = entries[winnerIndex].visitorId as string;
  const now = Date.now();

  await sql`
    UPDATE lucky_draws SET status = 'drawn', winner_visitor_id = ${winnerVisitorId}, drawn_at = ${now}
    WHERE id = ${drawId} AND status != 'drawn'
  `;
  await sql`
    INSERT INTO rewards (visitor_id, type, label, source, status, created_at)
    VALUES (${winnerVisitorId}, 'bonus', ${draws[0].rewardLabel}, 'lucky_draw', 'available', ${now})
  `;
  await logAudit(actor, "lucky_draw.drawn", String(drawId), { entries: entries.length, winnerVisitorId });
  return { ok: true, winnerVisitorId };
}
