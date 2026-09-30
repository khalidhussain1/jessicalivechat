import { NextResponse } from "next/server";
import { AGENT_COOKIE } from "@/lib/agent-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AGENT_COOKIE);
  return response;
}
