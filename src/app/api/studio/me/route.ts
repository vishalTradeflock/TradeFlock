import { NextResponse } from "next/server";
import { studioHomePath } from "@/lib/studio/roles";
import { getStudioSession } from "@/lib/studio/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getStudioSession();
  if (!session) {
    return NextResponse.json({ error: "No studio profile for this account." }, { status: 403 });
  }

  return NextResponse.json({
    role: session.profile.role,
    home: studioHomePath(session.profile.role),
  });
}
