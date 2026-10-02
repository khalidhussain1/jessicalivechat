import { NextRequest, NextResponse } from "next/server";
import { enterDraw } from "@/lib/draws-db";
import { isCustomerBlocked } from "@/lib/moderation-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }
  if (await isCustomerBlocked(visitorId)) {
    return NextResponse.json({ error: "This account cannot enter draws right now" }, { status: 403 });
  }

  const result = await enterDraw(Number(id), visitorId);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason === "full" ? "This draw is full" : "This draw is not open for entries" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
