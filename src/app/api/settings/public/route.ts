import { NextResponse } from "next/server";
import { getPublicSettings } from "@/lib/settings-db";

export const runtime = "nodejs";

export async function GET() {
  const settings = await getPublicSettings();
  return NextResponse.json(settings);
}
