import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById, updateUserProfile } from "@/lib/users-db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: user.name,
    email: user.email,
    phone: user.phone,
    provider: user.provider,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const phoneRaw = typeof body?.phone === "string" ? body.phone.trim() : undefined;

  if (name !== undefined && name.length === 0) {
    return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
  }
  if (name !== undefined && name.length > 100) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }
  if (phoneRaw !== undefined && phoneRaw.length > 0 && !/^[0-9+\-() .]{5,20}$/.test(phoneRaw)) {
    return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
  }

  const phone = phoneRaw === undefined ? undefined : phoneRaw.length === 0 ? null : phoneRaw;
  const user = await updateUserProfile(session.user.id, { name, phone });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ name: user.name, email: user.email, phone: user.phone });
}
