import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/lib/chat-db";
import { saveImageUpload, UploadError } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const visitorId = formData?.get("visitorId");
  const file = formData?.get("file");
  const senderName = formData?.get("senderName");

  if (typeof visitorId !== "string" || !visitorId || !(file instanceof File)) {
    return NextResponse.json({ error: "visitorId and file are required" }, { status: 400 });
  }

  try {
    const imageUrl = await saveImageUpload(file);
    const message = await addMessage(visitorId, "user", "", {
      imageUrl,
      senderName: typeof senderName === "string" ? senderName : undefined,
    });
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
