import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { drawWinner } from "@/lib/draws-db";

export const runtime = "nodejs";

// drawing a winner is a one-way, highly consequential action — restricted to
// super_admin, same bar as other irreversible actions in this app (e.g. Agents management)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "super_admin");
  if ("response" in check) return check.response;

  const result = await drawWinner(Number(id), check.session);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason === "no_entries" ? "No entries to draw from" : "This draw has already been drawn" },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, winnerVisitorId: result.winnerVisitorId });
}
