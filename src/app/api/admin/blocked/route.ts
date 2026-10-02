import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listBlockedCustomers, blockCustomer } from "@/lib/moderation-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;
  return NextResponse.json({ blocked: await listBlockedCustomers() });
}

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 300) : null;

  await blockCustomer(visitorId, reason, check.session.id);
  await logAudit(check.session, "customer.block", visitorId, { reason });
  return NextResponse.json({ ok: true });
}
