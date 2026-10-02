import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { unblockCustomer } from "@/lib/moderation-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ visitorId: string }> }) {
  const { visitorId } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  await unblockCustomer(visitorId);
  await logAudit(check.session, "customer.unblock", visitorId);
  return NextResponse.json({ ok: true });
}
