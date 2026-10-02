import { NextResponse } from "next/server";
import { listActiveAnnouncements, listEnabledQuickQuestions, listEnabledFaqs } from "@/lib/content-db";

export const runtime = "nodejs";

export async function GET() {
  const [announcements, quickQuestions, faqs] = await Promise.all([
    listActiveAnnouncements(),
    listEnabledQuickQuestions(),
    listEnabledFaqs(),
  ]);
  return NextResponse.json({ announcements, quickQuestions, faqs });
}
