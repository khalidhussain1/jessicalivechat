import { NextRequest, NextResponse } from "next/server";
import { listTasks, hasOpenSubmission, submitTaskProof } from "@/lib/tasks-db";
import { saveImageUpload, UploadError } from "@/lib/uploads";
import { isCustomerBlocked, isRateLimited } from "@/lib/moderation-db";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData().catch(() => null);
  const visitorId = formData?.get("visitorId");
  const proofText = formData?.get("proofText");
  const file = formData?.get("file");

  if (typeof visitorId !== "string" || !visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }
  if (await isCustomerBlocked(visitorId)) {
    return NextResponse.json({ error: "This account is not able to submit tasks right now" }, { status: 403 });
  }
  if (await isRateLimited(visitorId)) {
    return NextResponse.json({ error: "Please slow down and try again shortly" }, { status: 429 });
  }

  const task = (await listTasks()).find((t) => t.id === Number(id));
  if (!task || !task.enabled) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (await hasOpenSubmission(visitorId, task)) {
    return NextResponse.json({ error: "You already have a submission in review for this task" }, { status: 409 });
  }

  const text = typeof proofText === "string" ? proofText.replace(/<[^>]*>/g, "").slice(0, 1000) : null;
  if (!text && !(file instanceof File)) {
    return NextResponse.json({ error: "Please provide proof text or an image" }, { status: 400 });
  }

  let imageUrl: string | null = null;
  if (file instanceof File) {
    try {
      imageUrl = await saveImageUpload(file, "task-proof-uploads");
    } catch (error) {
      if (error instanceof UploadError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  }

  const submission = await submitTaskProof(visitorId, task.id, text, imageUrl);
  return NextResponse.json({ submission });
}
