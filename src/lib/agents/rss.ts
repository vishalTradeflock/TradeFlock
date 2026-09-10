export type ParsedFeedItem = {
  title: string;
  link: string;
  summary: string;
  publishedAt: number;
};

function decodeXmlEntities(value: string): string {
  let decoded = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let i = 0; i < 3; i += 1) {
    const next = decoded
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code: string) => {
        const point = Number(code);
        return Number.isFinite(point) ? String.fromCodePoint(point) : "";
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
        const point = Number.parseInt(hex, 16);
        return Number.isFinite(point) ? String.fromCodePoint(point) : "";
      })
      .replace(/&amp;/g, "&");
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function stripMarkup(value: string): string {
  return decodeXmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function innerTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? stripMarkup(match[1]) : null;
}

function extractLink(block: string): string | null {
  const rssLink = innerTag(block, "link");
  if (rssLink && /^https?:\/\//i.test(rssLink)) return rssLink;

  const hrefs = [...block.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi)];
  const preferred =
    hrefs.find((match) => /rel=["']alternate["']/i.test(match[0])) ??
    hrefs.find((match) => /^https?:\/\//i.test(match[1] ?? ""));
  if (preferred?.[1] && /^https?:\/\//i.test(preferred[1])) {
    return preferred[1].trim();
  }

  const guid = innerTag(block, "guid");
  if (guid && /^https?:\/\//i.test(guid)) return guid;

  return null;
}

function extractSummary(block: string): string {
  const description = innerTag(block, "description");
  if (description) return description;

  const summary = innerTag(block, "summary");
  if (summary) return summary;

  // Full-article content:encoded is a last resort and is truncated by the caller.
  return innerTag(block, "content:encoded") ?? innerTag(block, "content") ?? "";
}

function extractPublishedAt(block: string): number {
  const raw =
    innerTag(block, "pubDate") ??
    innerTag(block, "published") ??
    innerTag(block, "updated") ??
    innerTag(block, "dc:date");
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

export function parseFeedItems(xml: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const itemRe = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;

  for (const match of xml.matchAll(itemRe)) {
    const block = match[2] ?? "";
    const title = innerTag(block, "title");
    const link = extractLink(block);
    if (!title || !link) continue;

    items.push({
      title,
      link,
      summary: extractSummary(block),
      publishedAt: extractPublishedAt(block),
    });
  }

  return items;
}
