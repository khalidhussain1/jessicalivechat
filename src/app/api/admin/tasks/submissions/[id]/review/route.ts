import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { reviewSubmission } from "@/lib/tasks-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const decision = body?.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  await reviewSubmission(Number(id), decision, check.session);
  return NextResponse.json({ ok: true });
}
