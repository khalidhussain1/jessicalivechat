import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/lib/chat-db";
import { isCustomerBlocked, isRateLimited } from "@/lib/moderation-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const senderName = typeof body?.senderName === "string" ? body.senderName.trim() : undefined;
  const quickQuestionId = typeof body?.quickQuestionId === "number" ? body.quickQuestionId : undefined;

  if (!visitorId || !text) {
    return NextResponse.json({ error: "visitorId and text are required" }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }
  if (await isCustomerBlocked(visitorId)) {
    return NextResponse.json({ error: "This conversation is no longer accepting new messages" }, { status: 403 });
  }
  if (await isRateLimited(visitorId)) {
    return NextResponse.json({ error: "You're sending messages too quickly. Please slow down." }, { status: 429 });
  }

  const message = await addMessage(visitorId, "user", text, { senderName, quickQuestionId });

  return NextResponse.json({ message });
}
