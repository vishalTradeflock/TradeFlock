import type { MagazineHonoree } from "@/lib/types";

const PERSON_NAME =
  /^(?:Dr\.?\s+)?[A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){0,5}(?:,?\s*(?:MD|PhD|DO|Jr\.?|Sr\.?|III|II))?$/;

function decode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\\u0022/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string) {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "));
}

export function isPersonName(value: string, magazineTitle?: string) {
  const name = value.trim();
  if (!name || name.length < 4 || name.length > 80) return false;
  if (magazineTitle && name.toLowerCase() === magazineTitle.trim().toLowerCase()) return false;
  if (
    /tradeflock|digital edition|flipbook|access magazine|all magazines|success insight|other success/i.test(
      name,
    )
  ) {
    return false;
  }
  if (/\b(?:llc|inc|ltd|llp|corp|gmbh|plc)\b/i.test(name)) return false;
  if (/\.(ai|com|io|co|net|org)\b/i.test(name)) return false;
  if (name.split(/\s+/).length < 2) return false;
  return PERSON_NAME.test(name);
}

function pickPhoto(url: string) {
  const clean = url.replace(/["']/g, "").trim();
  if (!clean || /placeholder|logo|banner|favicon|google-news/i.test(clean)) return "";
  if (!/^https:\/\/(?:www\.)?tradeflockusa\.com\/wp-content\/uploads\//i.test(clean)) return "";
  return clean.split("?")[0] ?? clean;
}

function parseBackgrounds(css: string) {
  const map = new Map<string, string>();
  const pattern =
    /\.elementor-element-([a-z0-9]+)[^{]*\{[^}]*background-image:\s*url\(([^)]+)\)/gi;
  for (const match of css.matchAll(pattern)) {
    const photo = pickPhoto(match[2] ?? "");
    if (photo) map.set(match[1], photo);
  }
  return map;
}

function extractLinkedIn(block: string, name: string) {
  const hrefs = [...block.matchAll(/https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub)\/[A-Za-z0-9_%\-./]+/gi)].map(
    (match) => match[0].replace(/\/$/, ""),
  );
  const tokens = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !["with", "from", "ltd", "inc"].includes(token));
  return (
    hrefs.find((href) => {
      const haystack = href.toLowerCase();
      return tokens.some((token) => haystack.includes(token));
    }) ?? null
  );
}

function extractHeadings(block: string) {
  const titles = [...block.matchAll(/<(h2|p)[^>]*class="[^"]*elementor-heading-title[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi)].map(
    (match) => stripTags(match[2] ?? ""),
  );
  return titles.filter(Boolean);
}

function extractBio(block: string) {
  const editors = [...block.matchAll(/elementor-widget-text-editor[\s\S]{0,400}<p[^>]*>([\s\S]*?)<\/p>/gi)];
  for (const match of editors) {
    const text = stripTags(match[1] ?? "");
    if (text.length > 40) return text;
  }
  return "";
}

function extractCoverPhoto(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const around = html.match(new RegExp(`<img[^>]+alt="${escaped}"[^>]*>`, "i"));
  const src = around?.[0]?.match(/src="([^"]+)"/i)?.[1];
  if (src) return pickPhoto(src);
  const nearby = html.match(
    new RegExp(`src="(https://www\\.tradeflockusa\\.com/wp-content/uploads/[^"]+)"[^>]*alt="${escaped}"`, "i"),
  );
  return nearby?.[1] ? pickPhoto(nearby[1]) : "";
}

export function parseLegacyHonoreeHtml(
  html: string,
  cssChunks: string[],
  magazineTitle?: string,
): MagazineHonoree[] {
  const backgrounds = new Map<string, string>();
  for (const css of cssChunks) {
    for (const [id, url] of parseBackgrounds(css)) backgrounds.set(id, url);
  }

  const fromMembers = new Map<string, MagazineHonoree>();

  const memberPattern =
    /<div[^>]*class="[^"]*elementor-element-([a-z0-9]+)[^"]*team_member[^"]*"[^>]*>([\s\S]{0,12000}?)(?=<div[^>]*class="[^"]*team_member|<\/section>[\s\S]{0,80}<section class="elementor-section elementor-top-section|$)/gi;

  for (const match of html.matchAll(memberPattern)) {
    const id = match[1];
    const block = match[2] ?? "";
    const headings = extractHeadings(block);
    const name = headings.find((heading) => isPersonName(heading, magazineTitle));
    if (!name) continue;
    const extras = headings.filter((heading) => heading !== name);
    fromMembers.set(name.toLowerCase(), {
      name,
      designation: extras[0] || null,
      company: extras[1] || null,
      bio: extractBio(block) || null,
      photo_url: (id ? backgrounds.get(id) : null) || extractCoverPhoto(block, name) || null,
      linkedin_url: extractLinkedIn(block, name),
      page: null,
      magazine_page: null,
      slug: null,
    });
  }

  const headingNames = [...html.matchAll(/<h2[^>]*class="[^"]*elementor-heading-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((match) => stripTags(match[1] ?? ""))
    .filter((name) => isPersonName(name, magazineTitle));

  const ordered = headingNames.length ? headingNames : [...fromMembers.values()].map((row) => row.name);
  const honorees: MagazineHonoree[] = [];
  const seen = new Set<string>();

  for (const name of ordered) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const member = fromMembers.get(key);
    honorees.push(
      member ?? {
        name,
        designation: null,
        company: null,
        bio: null,
        photo_url: extractCoverPhoto(html, name) || null,
        linkedin_url: extractLinkedIn(html, name),
        page: null,
        magazine_page: null,
        slug: null,
      },
    );
  }

  for (const member of fromMembers.values()) {
    const key = member.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    honorees.push(member);
  }

  return honorees.map((honoree, index) => {
    const page = index * 2 + 4;
    return { ...honoree, page, magazine_page: page };
  });
}

function elementorCssHrefs(html: string) {
  return [...html.matchAll(/href="(https:\/\/www\.tradeflockusa\.com\/wp-content\/uploads\/elementor\/css\/post-\d+\.css[^"]*)"/gi)].map(
    (match) => match[1],
  );
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return "";
  return response.text();
}

export async function fetchLegacyHonorees(slug: string, magazineTitle?: string) {
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!clean || !/^[a-z0-9-]+$/.test(clean)) return [] as MagazineHonoree[];

  const urls = [
    `https://www.tradeflockusa.com/${clean}/`,
    `https://www.tradeflockusa.com/${clean}`,
    `https://tradeflockusa.com/${clean}/`,
  ];

  let html = "";
  for (const url of urls) {
    try {
      html = await fetchText(url);
      if (html.includes("elementor") || html.includes("team_member") || /<h2/i.test(html)) break;
    } catch {
      html = "";
    }
  }
  if (!html) return [];

  const cssChunks: string[] = [];
  for (const href of elementorCssHrefs(html).slice(0, 6)) {
    try {
      const css = await fetchText(href);
      if (css) cssChunks.push(css);
    } catch {
      /* skip stylesheet */
    }
  }

  return parseLegacyHonoreeHtml(html, cssChunks, magazineTitle);
}
