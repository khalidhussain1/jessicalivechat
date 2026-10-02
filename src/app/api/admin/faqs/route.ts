import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listFaqs, createFaq } from "@/lib/content-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;
  return NextResponse.json({ faqs: await listFaqs() });
}

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.replace(/<[^>]*>/g, "").slice(0, 300) : "";
  const answer = typeof body?.answer === "string" ? body.answer.replace(/<[^>]*>/g, "").slice(0, 2000) : "";
  if (!question || !answer) {
    return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
  }

  const faq = await createFaq({ question, answer });
  await logAudit(check.session, "faq.create", String(faq.id));
  return NextResponse.json({ faq });
}
