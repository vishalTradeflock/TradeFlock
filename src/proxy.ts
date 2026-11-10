import type { NextRequest } from "next/server";
import { updateStudioSession } from "@/lib/supabase/middleware";

export default async function proxy(request: NextRequest) {
  return updateStudioSession(request);
}

export const config = {
  matcher: ["/studio", "/studio/:path*"],
};
