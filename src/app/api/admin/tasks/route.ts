import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listTasks, createTask, type TaskType } from "@/lib/tasks-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const VALID_TYPES: TaskType[] = ["social_share", "page_visit", "game_challenge", "quiz", "daily_login", "support_interaction", "manual_proof"];

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;
  return NextResponse.json({ tasks: await listTasks() });
}

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.replace(/<[^>]*>/g, "").slice(0, 80) : "";
  const description = typeof body?.description === "string" ? body.description.replace(/<[^>]*>/g, "").slice(0, 300) : "";
  const instructions = typeof body?.instructions === "string" ? body.instructions.replace(/<[^>]*>/g, "").slice(0, 500) : "";
  const rewardLabel = typeof body?.rewardLabel === "string" ? body.rewardLabel.slice(0, 60) : "";
  const type: TaskType = VALID_TYPES.includes(body?.type) ? body.type : "manual_proof";
  if (!title || !rewardLabel) {
    return NextResponse.json({ error: "title and rewardLabel are required" }, { status: 400 });
  }

  const task = await createTask({
    title,
    description,
    type,
    instructions,
    rewardType: typeof body?.rewardType === "string" ? body.rewardType : "points",
    rewardLabel,
    repeatable: body?.repeatable === true,
    deadline: typeof body?.deadline === "number" ? body.deadline : null,
  });
  await logAudit(check.session, "task.create", String(task.id));
  return NextResponse.json({ task });
}
