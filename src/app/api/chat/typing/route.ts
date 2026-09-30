import { NextRequest, NextResponse } from "next/server";
import { setTyping } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }

  await setTyping(visitorId, "user");
  return NextResponse.json({ ok: true });
}
