import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listQuickQuestions, createQuickQuestion } from "@/lib/content-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;
  return NextResponse.json({ quickQuestions: await listQuickQuestions() });
}

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.replace(/<[^>]*>/g, "").slice(0, 60) : "";
  const message = typeof body?.message === "string" ? body.message.replace(/<[^>]*>/g, "").slice(0, 500) : "";
  const icon = typeof body?.icon === "string" ? body.icon.slice(0, 8) : "";
  if (!label || !message) {
    return NextResponse.json({ error: "label and message are required" }, { status: 400 });
  }

  const q = await createQuickQuestion({ icon, label, message });
  await logAudit(check.session, "quick_question.create", String(q.id));
  return NextResponse.json({ quickQuestion: q });
}
