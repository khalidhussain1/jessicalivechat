import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listSubmissionsByStatus, type SubmissionStatus } from "@/lib/tasks-db";

export const runtime = "nodejs";

const VALID: SubmissionStatus[] = ["pending", "approved", "rejected"];

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;

  const statusParam = request.nextUrl.searchParams.get("status");
  const status: SubmissionStatus = VALID.includes(statusParam as SubmissionStatus) ? (statusParam as SubmissionStatus) : "pending";
  return NextResponse.json({ submissions: await listSubmissionsByStatus(status) });
}
