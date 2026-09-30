import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const senderName = typeof body?.senderName === "string" ? body.senderName.trim() : undefined;

  if (!visitorId || !text) {
    return NextResponse.json({ error: "visitorId and text are required" }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }

  const message = await addMessage(visitorId, "user", text, { senderName });

  return NextResponse.json({ message });
}
