import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { closeDraw, reopenDraw } from "@/lib/draws-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  if (body?.status === "closed") {
    await closeDraw(Number(id));
    await logAudit(check.session, "lucky_draw.close", id);
  } else if (body?.status === "open") {
    await reopenDraw(Number(id));
    await logAudit(check.session, "lucky_draw.reopen", id);
  } else {
    return NextResponse.json({ error: "status must be 'open' or 'closed'" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
