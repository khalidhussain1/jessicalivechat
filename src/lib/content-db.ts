import { sql, ensureSchema } from "@/lib/db";

export type AnnouncementType = "info" | "success" | "warning" | "important";

export type Announcement = {
  id: number;
  text: string;
  type: AnnouncementType;
  enabled: boolean;
  dismissible: boolean;
  linkLabel: string | null;
  linkUrl: string | null;
  startsAt: number | null;
  endsAt: number | null;
  sortOrder: number;
  createdAt: number;
};

export type QuickQuestion = {
  id: number;
  icon: string;
  label: string;
  message: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
};

export type Faq = {
  id: number;
  question: string;
  answer: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
};

export type CannedReply = {
  id: number;
  category: string;
  text: string;
  createdAt: number;
};

// seeded verbatim from the quick actions that already exist in SupportChat.tsx — the
// message sent is the label itself (with its icon), exactly as it is today, so migrating
// to this DB-backed system changes nothing for "Game question" or any other default
// button until an admin deliberately edits one
const DEFAULT_QUICK_QUESTIONS: { seedKey: string; icon: string; label: string; message: string }[] = [
  { seedKey: "need_account", icon: "👤", label: "I need account?", message: "👤 I need account?" },
  { seedKey: "payment_method", icon: "💳", label: "Payment method?", message: "💳 Payment method?" },
  { seedKey: "anyone_available", icon: "💬", label: "Is anyone available to chat?", message: "💬 Is anyone available to chat?" },
  { seedKey: "game_question", icon: "🎮", label: "Game question", message: "🎮 Game question" },
];

function toAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: Number(row.id),
    text: row.text as string,
    type: row.type as AnnouncementType,
    enabled: row.enabled as boolean,
    dismissible: row.dismissible as boolean,
    linkLabel: row.linkLabel as string | null,
    linkUrl: row.linkUrl as string | null,
    startsAt: row.startsAt != null ? Number(row.startsAt) : null,
    endsAt: row.endsAt != null ? Number(row.endsAt) : null,
    sortOrder: Number(row.sortOrder),
    createdAt: Number(row.createdAt),
  };
}

const ANNOUNCEMENT_FIELDS = `
  id, text, type, enabled, dismissible, link_label as "linkLabel", link_url as "linkUrl",
  starts_at as "startsAt", ends_at as "endsAt", sort_order as "sortOrder", created_at as "createdAt"
`;

export async function listAnnouncements(): Promise<Announcement[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT ${sql.unsafe(ANNOUNCEMENT_FIELDS)} FROM announcements ORDER BY sort_order ASC, id ASC
  `;
  return rows.map(toAnnouncement);
}

export async function listActiveAnnouncements(): Promise<Announcement[]> {
  await ensureSchema();
  const now = Date.now();
  const rows = await sql`
    SELECT ${sql.unsafe(ANNOUNCEMENT_FIELDS)} FROM announcements
    WHERE enabled = true
      AND (starts_at IS NULL OR starts_at <= ${now})
      AND (ends_at IS NULL OR ends_at >= ${now})
    ORDER BY sort_order ASC, id ASC
  `;
  return rows.map(toAnnouncement);
}

export async function createAnnouncement(input: {
  text: string;
  type: AnnouncementType;
  dismissible: boolean;
  linkLabel?: string | null;
  linkUrl?: string | null;
  startsAt?: number | null;
  endsAt?: number | null;
}): Promise<Announcement> {
  await ensureSchema();
  const now = Date.now();
  const rows = await sql`
    INSERT INTO announcements (text, type, enabled, dismissible, link_label, link_url, starts_at, ends_at, sort_order, created_at)
    VALUES (${input.text}, ${input.type}, true, ${input.dismissible}, ${input.linkLabel ?? null},
            ${input.linkUrl ?? null}, ${input.startsAt ?? null}, ${input.endsAt ?? null}, 0, ${now})
    RETURNING ${sql.unsafe(ANNOUNCEMENT_FIELDS)}
  `;
  return toAnnouncement(rows[0]);
}

export async function updateAnnouncement(
  id: number,
  patch: Partial<{
    text: string;
    type: AnnouncementType;
    enabled: boolean;
    dismissible: boolean;
    linkLabel: string | null;
    linkUrl: string | null;
    startsAt: number | null;
    endsAt: number | null;
    sortOrder: number;
  }>,
): Promise<void> {
  await ensureSchema();
  const current = (await sql`SELECT ${sql.unsafe(ANNOUNCEMENT_FIELDS)} FROM announcements WHERE id = ${id}`)[0];
  if (!current) return;
  const merged = { ...toAnnouncement(current), ...patch };
  await sql`
    UPDATE announcements SET
      text = ${merged.text}, type = ${merged.type}, enabled = ${merged.enabled},
      dismissible = ${merged.dismissible}, link_label = ${merged.linkLabel}, link_url = ${merged.linkUrl},
      starts_at = ${merged.startsAt}, ends_at = ${merged.endsAt}, sort_order = ${merged.sortOrder}
    WHERE id = ${id}
  `;
}

export async function deleteAnnouncement(id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM announcements WHERE id = ${id}`;
}

function toQuickQuestion(row: Record<string, unknown>): QuickQuestion {
  return {
    id: Number(row.id),
    icon: row.icon as string,
    label: row.label as string,
    message: row.message as string,
    enabled: row.enabled as boolean,
    sortOrder: Number(row.sortOrder),
    createdAt: Number(row.createdAt),
  };
}

const QUICK_QUESTION_FIELDS = `
  id, icon, label, message, enabled, sort_order as "sortOrder", created_at as "createdAt"
`;

// seed_key is UNIQUE, so this is safe against concurrent first-requests racing each
// other (no "check count, then insert" gap where both could pass the check and double-insert).
// Existing rows created before seed_key existed are backfilled by label so they're
// recognized as already-seeded instead of getting a duplicate set inserted alongside them.
async function seedQuickQuestionsIfEmpty() {
  const now = Date.now();
  for (let i = 0; i < DEFAULT_QUICK_QUESTIONS.length; i++) {
    const q = DEFAULT_QUICK_QUESTIONS[i];
    await sql`
      UPDATE quick_questions SET seed_key = ${q.seedKey} WHERE label = ${q.label} AND seed_key IS NULL
    `;
    await sql`
      INSERT INTO quick_questions (icon, label, message, enabled, sort_order, created_at, seed_key)
      VALUES (${q.icon}, ${q.label}, ${q.message}, true, ${i}, ${now}, ${q.seedKey})
      ON CONFLICT (seed_key) DO NOTHING
    `;
  }
}

export async function listQuickQuestions(): Promise<QuickQuestion[]> {
  await ensureSchema();
  await seedQuickQuestionsIfEmpty();
  const rows = await sql`
    SELECT ${sql.unsafe(QUICK_QUESTION_FIELDS)} FROM quick_questions ORDER BY sort_order ASC, id ASC
  `;
  return rows.map(toQuickQuestion);
}

export async function listEnabledQuickQuestions(): Promise<QuickQuestion[]> {
  const all = await listQuickQuestions();
  return all.filter((q) => q.enabled);
}

export async function createQuickQuestion(input: { icon: string; label: string; message: string }): Promise<QuickQuestion> {
  await ensureSchema();
  const now = Date.now();
  const maxOrder = await sql`SELECT COALESCE(MAX(sort_order), -1) as max FROM quick_questions`;
  const rows = await sql`
    INSERT INTO quick_questions (icon, label, message, enabled, sort_order, created_at)
    VALUES (${input.icon}, ${input.label}, ${input.message}, true, ${Number(maxOrder[0].max) + 1}, ${now})
    RETURNING ${sql.unsafe(QUICK_QUESTION_FIELDS)}
  `;
  return toQuickQuestion(rows[0]);
}

export async function updateQuickQuestion(
  id: number,
  patch: Partial<{ icon: string; label: string; message: string; enabled: boolean; sortOrder: number }>,
): Promise<void> {
  await ensureSchema();
  const current = (await sql`SELECT ${sql.unsafe(QUICK_QUESTION_FIELDS)} FROM quick_questions WHERE id = ${id}`)[0];
  if (!current) return;
  const merged = { ...toQuickQuestion(current), ...patch };
  await sql`
    UPDATE quick_questions SET icon = ${merged.icon}, label = ${merged.label}, message = ${merged.message},
      enabled = ${merged.enabled}, sort_order = ${merged.sortOrder}
    WHERE id = ${id}
  `;
}

export async function deleteQuickQuestion(id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM quick_questions WHERE id = ${id}`;
}

function toFaq(row: Record<string, unknown>): Faq {
  return {
    id: Number(row.id),
    question: row.question as string,
    answer: row.answer as string,
    enabled: row.enabled as boolean,
    sortOrder: Number(row.sortOrder),
    createdAt: Number(row.createdAt),
  };
}

const FAQ_FIELDS = `id, question, answer, enabled, sort_order as "sortOrder", created_at as "createdAt"`;

export async function listFaqs(): Promise<Faq[]> {
  await ensureSchema();
  const rows = await sql`SELECT ${sql.unsafe(FAQ_FIELDS)} FROM faqs ORDER BY sort_order ASC, id ASC`;
  return rows.map(toFaq);
}

export async function listEnabledFaqs(): Promise<Faq[]> {
  const all = await listFaqs();
  return all.filter((f) => f.enabled);
}

export async function createFaq(input: { question: string; answer: string }): Promise<Faq> {
  await ensureSchema();
  const now = Date.now();
  const maxOrder = await sql`SELECT COALESCE(MAX(sort_order), -1) as max FROM faqs`;
  const rows = await sql`
    INSERT INTO faqs (question, answer, enabled, sort_order, created_at)
    VALUES (${input.question}, ${input.answer}, true, ${Number(maxOrder[0].max) + 1}, ${now})
    RETURNING ${sql.unsafe(FAQ_FIELDS)}
  `;
  return toFaq(rows[0]);
}

export async function updateFaq(
  id: number,
  patch: Partial<{ question: string; answer: string; enabled: boolean; sortOrder: number }>,
): Promise<void> {
  await ensureSchema();
  const current = (await sql`SELECT ${sql.unsafe(FAQ_FIELDS)} FROM faqs WHERE id = ${id}`)[0];
  if (!current) return;
  const merged = { ...toFaq(current), ...patch };
  await sql`
    UPDATE faqs SET question = ${merged.question}, answer = ${merged.answer},
      enabled = ${merged.enabled}, sort_order = ${merged.sortOrder}
    WHERE id = ${id}
  `;
}

export async function deleteFaq(id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM faqs WHERE id = ${id}`;
}

function toCannedReply(row: Record<string, unknown>): CannedReply {
  return {
    id: Number(row.id),
    category: row.category as string,
    text: row.text as string,
    createdAt: Number(row.createdAt),
  };
}

export async function listCannedReplies(): Promise<CannedReply[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, category, text, created_at as "createdAt" FROM canned_replies ORDER BY category ASC, id ASC
  `;
  return rows.map(toCannedReply);
}

export async function createCannedReply(input: { category: string; text: string }): Promise<CannedReply> {
  await ensureSchema();
  const now = Date.now();
  const rows = await sql`
    INSERT INTO canned_replies (category, text, created_at)
    VALUES (${input.category}, ${input.text}, ${now})
    RETURNING id, category, text, created_at as "createdAt"
  `;
  return toCannedReply(rows[0]);
}

export async function updateCannedReply(id: number, patch: Partial<{ category: string; text: string }>): Promise<void> {
  await ensureSchema();
  const current = (await sql`SELECT id, category, text, created_at as "createdAt" FROM canned_replies WHERE id = ${id}`)[0];
  if (!current) return;
  const merged = { ...toCannedReply(current), ...patch };
  await sql`UPDATE canned_replies SET category = ${merged.category}, text = ${merged.text} WHERE id = ${id}`;
}

export async function deleteCannedReply(id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM canned_replies WHERE id = ${id}`;
}

export type QuickQuestionUsage = { label: string; count: number };

// most-used quick question, derived from messages.quick_question_id (set when a
// customer taps a quick-action button — free-typed messages leave it null)
export async function getMostCommonQuickQuestions(limit = 5): Promise<QuickQuestionUsage[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT q.label as "label", COUNT(*)::int as "count"
    FROM messages m
    JOIN quick_questions q ON q.id = m.quick_question_id
    GROUP BY q.label
    ORDER BY "count" DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ label: r.label as string, count: Number(r.count) }));
}

export type HourlyActivity = { hour: number; count: number };

// message volume by hour-of-day (0-23, server/UTC time), last 30 days
export async function getMostActiveHours(): Promise<HourlyActivity[]> {
  await ensureSchema();
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const rows = await sql`
    SELECT EXTRACT(HOUR FROM to_timestamp(created_at / 1000.0))::int as hour, COUNT(*)::int as count
    FROM messages
    WHERE created_at > ${since}
    GROUP BY hour
    ORDER BY hour ASC
  `;
  return rows.map((r) => ({ hour: Number(r.hour), count: Number(r.count) }));
}
