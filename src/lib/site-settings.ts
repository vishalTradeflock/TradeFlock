import { cache } from "react";
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

export const getHeaderScripts = cache(async (): Promise<HeaderScript[]> => {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("header_scripts")
      .limit(1)
      .maybeSingle();

    if (error || !data) return [];
    const raw = typeof data.header_scripts === "string" ? data.header_scripts : "";
    if (!raw.trim() || raw.length > HEADER_SCRIPT_LIMIT) return [];
    return asHeaderScripts(raw);
  } catch {
    return [];
  }
});
