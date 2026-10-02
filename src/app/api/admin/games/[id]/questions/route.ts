import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { sql, ensureSchema } from "@/lib/db";
import { listQuizQuestions } from "@/lib/games-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;
  return NextResponse.json({ questions: await listQuizQuestions(Number(id)) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.replace(/<[^>]*>/g, "").slice(0, 300) : "";
  const options = Array.isArray(body?.options) ? body.options.filter((o: unknown) => typeof o === "string").slice(0, 6) : [];
  const correctIndex = typeof body?.correctIndex === "number" ? body.correctIndex : 0;
  if (!question || options.length < 2 || correctIndex < 0 || correctIndex >= options.length) {
    return NextResponse.json({ error: "question, at least 2 options, and a valid correctIndex are required" }, { status: 400 });
  }

  await ensureSchema();
  const rows = await sql`
    INSERT INTO quiz_questions (game_id, question, options, correct_index, sort_order, created_at)
    VALUES (${Number(id)}, ${question}, ${JSON.stringify(options)}, ${correctIndex}, 0, ${Date.now()})
    RETURNING id
  `;
  await logAudit(check.session, "quiz_question.create", String(rows[0].id));
  return NextResponse.json({ ok: true, id: rows[0].id });
}
