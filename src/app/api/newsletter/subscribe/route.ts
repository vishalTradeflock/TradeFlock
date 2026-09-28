import { NextResponse } from "next/server";
import { normalizeNewsletterEmail } from "@/lib/newsletter";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Server error";
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const email =
      body && typeof body === "object" && "email" in body
        ? normalizeNewsletterEmail(body.email)
        : null;

    if (!email) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Newsletter is not configured." }, { status: 503 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("newsletter_subscribers").upsert(
      { email },
      { onConflict: "email", ignoreDuplicates: true },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: readErrorMessage(error) }, { status: 500 });
  }
}
