import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { sql, ensureSchema } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  await ensureSchema();
  await sql`DELETE FROM quiz_questions WHERE id = ${Number(questionId)}`;
  await logAudit(check.session, "quiz_question.delete", questionId);
  return NextResponse.json({ ok: true });
}
