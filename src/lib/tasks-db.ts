import { sql, ensureSchema } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AgentSession } from "@/lib/agent-auth";
import type { RewardType } from "@/lib/games-db";

export type TaskType = "social_share" | "page_visit" | "game_challenge" | "quiz" | "daily_login" | "support_interaction" | "manual_proof";

export type Task = {
  id: number;
  title: string;
  description: string;
  type: TaskType;
  instructions: string;
  rewardType: RewardType;
  rewardLabel: string;
  verificationMethod: "manual" | "auto";
  repeatable: boolean;
  deadline: number | null;
  enabled: boolean;
  sortOrder: number;
};

const TASK_FIELDS = `
  id, title, description, type, instructions, reward_type as "rewardType", reward_label as "rewardLabel",
  verification_method as "verificationMethod", repeatable, deadline, enabled, sort_order as "sortOrder"
`;

function toTask(row: Record<string, unknown>): Task {
  return {
    id: Number(row.id),
    title: row.title as string,
    description: row.description as string,
    type: row.type as TaskType,
    instructions: row.instructions as string,
    rewardType: row.rewardType as RewardType,
    rewardLabel: row.rewardLabel as string,
    verificationMethod: row.verificationMethod as "manual" | "auto",
    repeatable: row.repeatable as boolean,
    deadline: row.deadline != null ? Number(row.deadline) : null,
    enabled: row.enabled as boolean,
    sortOrder: Number(row.sortOrder),
  };
}

const DEFAULT_TASKS: { seedKey: string; title: string; description: string; type: TaskType; instructions: string; rewardLabel: string }[] = [
  {
    seedKey: "share_page",
    title: "Share our page",
    description: "Share Jessica Game Support with a friend",
    type: "social_share",
    instructions: "Share our page on your favorite social platform, then paste the link or a screenshot here as proof.",
    rewardLabel: "Free Play",
  },
  {
    seedKey: "follow_engage",
    title: "Follow & engage",
    description: "Follow our page and like a recent post",
    type: "social_share",
    instructions: "Follow our page and like a recent post, then tell us your username or attach a screenshot.",
    rewardLabel: "50 points",
  },
];

// seed_key is UNIQUE, so this is safe against concurrent first-requests racing each other
async function seedTasksIfEmpty() {
  const now = Date.now();
  for (let i = 0; i < DEFAULT_TASKS.length; i++) {
    const t = DEFAULT_TASKS[i];
    await sql`
      INSERT INTO tasks (title, description, type, instructions, reward_type, reward_label, verification_method, repeatable, enabled, sort_order, created_at, seed_key)
      VALUES (${t.title}, ${t.description}, ${t.type}, ${t.instructions}, 'points', ${t.rewardLabel}, 'manual', false, true, ${i}, ${now}, ${t.seedKey})
      ON CONFLICT (seed_key) DO NOTHING
    `;
  }
}

export async function listTasks(): Promise<Task[]> {
  await ensureSchema();
  await seedTasksIfEmpty();
  const rows = await sql`SELECT ${sql.unsafe(TASK_FIELDS)} FROM tasks ORDER BY sort_order ASC, id ASC`;
  return rows.map(toTask);
}

export async function listEnabledTasks(): Promise<Task[]> {
  const all = await listTasks();
  const now = Date.now();
  return all.filter((t) => t.enabled && (t.deadline == null || t.deadline > now));
}

export async function createTask(input: {
  title: string;
  description: string;
  type: TaskType;
  instructions: string;
  rewardType: RewardType;
  rewardLabel: string;
  repeatable: boolean;
  deadline: number | null;
}): Promise<Task> {
  await ensureSchema();
  const now = Date.now();
  const maxOrder = await sql`SELECT COALESCE(MAX(sort_order), -1) as max FROM tasks`;
  const rows = await sql`
    INSERT INTO tasks (title, description, type, instructions, reward_type, reward_label, verification_method, repeatable, deadline, enabled, sort_order, created_at)
    VALUES (${input.title}, ${input.description}, ${input.type}, ${input.instructions}, ${input.rewardType},
            ${input.rewardLabel}, 'manual', ${input.repeatable}, ${input.deadline}, true, ${Number(maxOrder[0].max) + 1}, ${now})
    RETURNING ${sql.unsafe(TASK_FIELDS)}
  `;
  return toTask(rows[0]);
}

export async function updateTask(id: number, patch: Partial<Omit<Task, "id">>): Promise<void> {
  await ensureSchema();
  const current = (await sql`SELECT ${sql.unsafe(TASK_FIELDS)} FROM tasks WHERE id = ${id}`)[0];
  if (!current) return;
  const merged = { ...toTask(current), ...patch };
  await sql`
    UPDATE tasks SET title = ${merged.title}, description = ${merged.description}, type = ${merged.type},
      instructions = ${merged.instructions}, reward_type = ${merged.rewardType}, reward_label = ${merged.rewardLabel},
      repeatable = ${merged.repeatable}, deadline = ${merged.deadline}, enabled = ${merged.enabled}, sort_order = ${merged.sortOrder}
    WHERE id = ${id}
  `;
}

export async function deleteTask(id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM tasks WHERE id = ${id}`;
}

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type TaskSubmission = {
  id: number;
  visitorId: string;
  taskId: number;
  taskTitle?: string;
  proofText: string | null;
  proofImageUrl: string | null;
  status: SubmissionStatus;
  reviewedBy: string | null;
  reviewedAt: number | null;
  createdAt: number;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// a visitor may NOT submit again while a pending/approved submission already exists for
// a one-time task, or for today on a repeatable task — but CAN retry after a rejection
export async function hasOpenSubmission(visitorId: string, task: Task): Promise<boolean> {
  await ensureSchema();
  const rows = task.repeatable
    ? await sql`
        SELECT 1 FROM task_submissions
        WHERE visitor_id = ${visitorId} AND task_id = ${task.id} AND status IN ('pending', 'approved') AND submission_date = ${todayKey()}
      `
    : await sql`
        SELECT 1 FROM task_submissions
        WHERE visitor_id = ${visitorId} AND task_id = ${task.id} AND status IN ('pending', 'approved')
      `;
  return rows.length > 0;
}

export async function submitTaskProof(
  visitorId: string,
  taskId: number,
  proofText: string | null,
  proofImageUrl: string | null,
): Promise<TaskSubmission> {
  await ensureSchema();
  const now = Date.now();
  const rows = await sql`
    INSERT INTO task_submissions (visitor_id, task_id, proof_text, proof_image_url, status, submission_date, created_at)
    VALUES (${visitorId}, ${taskId}, ${proofText}, ${proofImageUrl}, 'pending', ${todayKey()}, ${now})
    RETURNING id, visitor_id as "visitorId", task_id as "taskId", proof_text as "proofText",
      proof_image_url as "proofImageUrl", status, reviewed_by as "reviewedBy", reviewed_at as "reviewedAt", created_at as "createdAt"
  `;
  return { ...rows[0], id: Number(rows[0].id), taskId: Number(rows[0].taskId), createdAt: Number(rows[0].createdAt) } as TaskSubmission;
}

export async function listSubmissionsForVisitor(visitorId: string): Promise<TaskSubmission[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT s.id, s.visitor_id as "visitorId", s.task_id as "taskId", t.title as "taskTitle",
      s.proof_text as "proofText", s.proof_image_url as "proofImageUrl", s.status,
      s.reviewed_by as "reviewedBy", s.reviewed_at as "reviewedAt", s.created_at as "createdAt"
    FROM task_submissions s JOIN tasks t ON t.id = s.task_id
    WHERE s.visitor_id = ${visitorId} ORDER BY s.id DESC
  `;
  return rows.map((r) => ({ ...r, id: Number(r.id), taskId: Number(r.taskId), createdAt: Number(r.createdAt), reviewedAt: r.reviewedAt != null ? Number(r.reviewedAt) : null }) as TaskSubmission);
}

export async function listSubmissionsByStatus(status: SubmissionStatus): Promise<TaskSubmission[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT s.id, s.visitor_id as "visitorId", s.task_id as "taskId", t.title as "taskTitle",
      s.proof_text as "proofText", s.proof_image_url as "proofImageUrl", s.status,
      s.reviewed_by as "reviewedBy", s.reviewed_at as "reviewedAt", s.created_at as "createdAt"
    FROM task_submissions s JOIN tasks t ON t.id = s.task_id
    WHERE s.status = ${status} ORDER BY s.id ASC
  `;
  return rows.map((r) => ({ ...r, id: Number(r.id), taskId: Number(r.taskId), createdAt: Number(r.createdAt), reviewedAt: r.reviewedAt != null ? Number(r.reviewedAt) : null }) as TaskSubmission);
}

export async function reviewSubmission(
  submissionId: number,
  decision: "approved" | "rejected",
  reviewer: AgentSession,
): Promise<void> {
  await ensureSchema();
  const now = Date.now();
  const rows = await sql`
    SELECT s.id, s.visitor_id as "visitorId", s.status, t.reward_type as "rewardType", t.reward_label as "rewardLabel", t.title
    FROM task_submissions s JOIN tasks t ON t.id = s.task_id
    WHERE s.id = ${submissionId}
  `;
  const submission = rows[0];
  if (!submission || submission.status !== "pending") return;

  let rewardId: number | null = null;
  if (decision === "approved") {
    const rewardRows = await sql`
      INSERT INTO rewards (visitor_id, type, label, source, status, created_at)
      VALUES (${submission.visitorId}, ${submission.rewardType}, ${submission.rewardLabel}, 'task', 'available', ${now})
      RETURNING id
    `;
    rewardId = rewardRows[0].id;
  }

  await sql`
    UPDATE task_submissions SET status = ${decision}, reviewed_by = ${reviewer.name}, reviewed_at = ${now}, reward_id = ${rewardId}
    WHERE id = ${submissionId}
  `;
  await logAudit(reviewer, `task_submission.${decision}`, String(submissionId), { task: submission.title });
}
