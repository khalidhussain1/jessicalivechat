import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const entries = await listAuditLog();
  return NextResponse.json({ entries });
}
