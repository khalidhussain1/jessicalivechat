import { NextRequest, NextResponse } from "next/server";
import { AGENT_COOKIE, verifyAgentSessionToken } from "@/lib/agent-auth";
import { addMessage, markConversationRead } from "@/lib/chat-db";
import { saveImageUpload, UploadError } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AGENT_COOKIE)?.value;
  const session = await verifyAgentSessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const visitorId = formData?.get("visitorId");
  const file = formData?.get("file");

  if (typeof visitorId !== "string" || !visitorId || !(file instanceof File)) {
    return NextResponse.json({ error: "visitorId and file are required" }, { status: 400 });
  }

  try {
    const imageUrl = await saveImageUpload(file);
    const message = await addMessage(visitorId, "agent", "", {
      imageUrl,
      senderName: session.name,
    });
    await markConversationRead(visitorId);
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
