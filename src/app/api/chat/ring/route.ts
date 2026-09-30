import { NextRequest, NextResponse } from "next/server";
import { ringForHelp } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }

  const result = await ringForHelp(visitorId);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Please wait before ringing again", retryAfterMs: result.retryAfterMs },
      { status: 429 },
    );
  }

  return NextResponse.json({ ok: true, rungAt: result.rungAt });
}
