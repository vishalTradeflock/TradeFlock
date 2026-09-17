import { cache } from "react";
import { prepareGlobalHeadCode } from "@/lib/public-head";
import { sanitizeVerificationToken } from "@/lib/studio/head-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/utils";

const HEADER_SCRIPT_LIMIT = 100_000;

export type HeaderScript = {
  id: string;
  src?: string;
  js?: string;
};

function asHeaderScripts(raw: string): HeaderScript[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const scripts: HeaderScript[] = [];
  const tag = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match = tag.exec(trimmed);
  let index = 0;
  let foundTag = false;

  while (match) {
    foundTag = true;
    const attrs = match[1] ?? "";
    const src = attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1]?.trim();
    const js = (match[2] ?? "").trim().replace(/<\/script/gi, "<\\/script");
    if (src) {
      scripts.push({ id: index === 0 ? "global-head-scripts" : `global-head-scripts-${index}`, src });
      index += 1;
    } else if (js) {
      scripts.push({
        id: index === 0 ? "global-head-scripts" : `global-head-scripts-${index}`,
        js,
      });
      index += 1;
    }
    match = tag.exec(trimmed);
  }

  if (!foundTag) {
    scripts.push({
      id: "global-head-scripts",
      js: trimmed.replace(/<\/script/gi, "<\\/script"),
    });
  }

  return scripts;
}

function tryAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/**
 * header_scripts is not selected with the anon key.
 * Rendered on public pages only via the admin/service role.
 */
export const getHeaderScripts = cache(async (): Promise<HeaderScript[]> => {
  const admin = tryAdminClient();
  if (!admin) return [];

  try {
    const { data, error } = await admin
      .from("site_settings")
      .select("header_scripts")
      .eq("id", "default")
      .maybeSingle();

    if (error || !data) return [];
    const raw = typeof data.header_scripts === "string" ? data.header_scripts : "";
    if (!raw.trim() || raw.length > HEADER_SCRIPT_LIMIT) return [];
    return asHeaderScripts(raw);
  } catch {
    return [];
  }
});

/**
 * Raw HTML injected into <head> on public pages.
 *
 * SECURITY: This field has site-wide code execution capability (scripts, pixels,
 * JSON-LD). It must remain writable only by authorized Studio/masthead roles
 * through server actions. Anonymous and public users cannot write it. Do not
 * expose header_scripts or global_head_code through the anon PostgREST client.
 */
export const getGlobalHeadCode = cache(async (): Promise<string> => {
  const admin = tryAdminClient();
  if (!admin) return "";

  try {
    const { data, error } = await admin
      .from("site_settings")
      .select("global_head_code")
      .eq("id", "default")
      .maybeSingle();
    if (error || !data) return "";
    const raw = typeof data.global_head_code === "string" ? data.global_head_code : "";
    const prepared = prepareGlobalHeadCode(raw);
    return prepared.ok ? prepared.value ?? "" : "";
  } catch {
    return "";
  }
});

export type SiteVerification = {
  google: string | null;
  bing: string | null;
};

export const getSiteVerification = cache(async (): Promise<SiteVerification> => {
  const empty = { google: null, bing: null };
  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("google_site_verification, bing_site_verification")
      .eq("id", "default")
      .maybeSingle();
    if (error || !data) return empty;
    return {
      google: sanitizeVerificationToken(
        typeof data.google_site_verification === "string" ? data.google_site_verification : "",
      ),
      bing: sanitizeVerificationToken(
        typeof data.bing_site_verification === "string" ? data.bing_site_verification : "",
      ),
    };
  } catch {
    return empty;
  }
});
