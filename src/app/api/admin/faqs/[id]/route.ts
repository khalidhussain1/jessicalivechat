import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { updateFaq, deleteFaq } from "@/lib/content-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.question === "string") patch.question = body.question.replace(/<[^>]*>/g, "").slice(0, 300);
  if (typeof body.answer === "string") patch.answer = body.answer.replace(/<[^>]*>/g, "").slice(0, 2000);
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;

  await updateFaq(Number(id), patch);
  await logAudit(check.session, "faq.update", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  await deleteFaq(Number(id));
  await logAudit(check.session, "faq.delete", id);
  return NextResponse.json({ ok: true });
}
