import { NextResponse, type NextRequest } from "next/server";
import { updateStudioSession } from "@/lib/supabase/middleware";
import {
  isMaintenanceOn,
  isMaintenancePassThrough,
  maintenanceResponse,
} from "@/lib/maintenance";

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (isMaintenanceOn()) {
    if (isMaintenancePassThrough(path)) return NextResponse.next();
    return maintenanceResponse(request.method);
  }

  if (path === "/studio" || path.startsWith("/studio/")) {
    return updateStudioSession(request);
  }

  return NextResponse.next();
}

export const config = {
  // Every path while maintenance mode is on. Next.js internals (/_next) are
  // skipped so nothing else changes once it is turned off.
  matcher: ["/((?!_next/).*)"],
};
