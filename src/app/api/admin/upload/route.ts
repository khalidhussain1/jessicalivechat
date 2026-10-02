import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { saveImageUpload, UploadError } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  try {
    const url = await saveImageUpload(file, "branding-uploads");
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
