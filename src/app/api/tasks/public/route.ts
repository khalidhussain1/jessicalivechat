import { NextRequest, NextResponse } from "next/server";
import { listEnabledTasks, hasOpenSubmission } from "@/lib/tasks-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const visitorId = request.nextUrl.searchParams.get("visitorId");
  const tasks = await listEnabledTasks();

  const withStatus = await Promise.all(
    tasks.map(async (t) => ({
      ...t,
      hasOpenSubmission: visitorId ? await hasOpenSubmission(visitorId, t) : false,
    })),
  );

  return NextResponse.json({ tasks: withStatus });
}
