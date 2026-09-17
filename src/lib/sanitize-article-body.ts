function normalizeComparable(value: string) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function titlesMatch(htmlInner: string, title: string) {
  const left = normalizeComparable(htmlInner);
  const right = normalizeComparable(title);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 12 && right.includes(left)) return true;
  if (right.length >= 12 && left.includes(right)) return true;
  return false;
}

const LEADING_EMPTY =
  /^(?:\s+|<(?:p|div|span)[^>]*>\s*(?:<br\s*\/?>\s*)*<\/(?:p|div|span)>|<br\s*\/?>|&nbsp;)+/i;

function stripLeadingEmpty(html: string) {
  let out = html.trim();
  for (let i = 0; i < 8; i += 1) {
    const next = out.replace(LEADING_EMPTY, "").trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

function significantIndex(html: string, rawIndex: number) {
  return html.slice(0, rawIndex).replace(/\s+/g, " ").length;
}

function nextImgTag(html: string, from = 0) {
  const slice = html.slice(from);
  const startRel = slice.search(/<img\b/i);
  if (startRel === -1) return null;
  const start = from + startRel;
  const fromImg = html.slice(start);
  const tag = fromImg.match(/^<img\b[^>]*\/?>/i);
  if (!tag) return null;
  return { start, end: start + tag[0].length, tag: tag[0] };
}

function stripImgsInOpeningWindow(html: string, windowSize: number) {
  let out = html;
  for (let i = 0; i < 6; i += 1) {
    const img = nextImgTag(out);
    if (!img) break;
    if (significantIndex(out, img.start) > windowSize) break;
    out = `${out.slice(0, img.start)}${out.slice(img.end)}`;
  }
  return out;
}

function coverFileStem(coverImageUrl: string) {
  try {
    const file = new URL(coverImageUrl).pathname.split("/").pop() ?? "";
    return file.replace(/\.[a-z0-9]+$/i, "").replace(/-\d+x\d+$/i, "");
  } catch {
    return "";
  }
}

function stripCoverMatchingImages(html: string, coverImageUrl: string) {
  const stem = coverFileStem(coverImageUrl);
  if (stem.length < 8) return html;
  return html.replace(/<img\b[^>]*>/gi, (tag) => (tag.includes(stem) ? "" : tag));
}

function stripLeadingHeading(html: string, title: string) {
  return html.replace(
    /^\s*<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/i,
    (full, _tag: string, inner: string) => (titlesMatch(inner, title) ? "" : full),
  );
}

function stripLeadingChrome(html: string, title: string) {
  let out = html;
  for (let i = 0; i < 12; i += 1) {
    let next = stripLeadingEmpty(out);
    next = stripLeadingHeading(next, title);
    next = next.replace(/^\s*<p[^>]*>[\s\S]{0,90}<\/p>/i, "");
    next = next.replace(/^\s*[^<]{1,80}(?=<)/, "");
    if (next === out) break;
    out = next;
  }
  return stripLeadingEmpty(out);
}

const DISPLAY_CLASS = /\b(?:block|inline-block|flex|inline-flex|grid)\b/g;

function stripAnchorDisplayClasses(html: string) {
  return html.replace(/<a\b([^>]*)>/gi, (_full, attrs: string) => {
    const next = attrs.replace(/\sclass\s*=\s*(["'])([^"']*)\1/gi, (_m, quote: string, cls: string) => {
      const cleaned = cls.replace(DISPLAY_CLASS, " ").replace(/\s+/g, " ").trim();
      return cleaned ? ` class=${quote}${cleaned}${quote}` : "";
    });
    return `<a${next}>`;
  });
}

function compactAnchorText(html: string) {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_full, attrs: string, inner: string) => {
    const compact = inner.replace(/\s+/g, " ").trim();
    return `<a${attrs}>${compact}</a>`;
  });
}

function collapsePunctuationSpacing(html: string) {
  return html
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+(['’])s\b/g, "$1s")
    .replace(/ {2,}/g, " ")
    .replace(/<p>\s+/gi, "<p>")
    .replace(/\s+<\/p>/gi, "</p>");
}

/** Keep names like <a>Jane</a>'s in one sentence instead of split <p> wrappers. */
export function repairInlineAnchors(html: string) {
  let out = html;

  out = out.replace(/\s*\n\s*(<a\b[^>]*>)/gi, " $1");
  out = out.replace(/(<\/a>)\s*\n\s*/gi, "$1 ");
  out = out.replace(/(?:<br\s*\/?>\s*)+(<a\b)/gi, " $1");
  out = out.replace(/(<\/a>)(?:\s*<br\s*\/?>)+/gi, "$1 ");

  for (let i = 0; i < 8; i += 1) {
    const next = out.replace(
      /<\/p>\s*<p>\s*(<a\b[^>]*>[\s\S]*?<\/a>)\s*<\/p>\s*<p>/gi,
      " $1 ",
    );
    if (next === out) break;
    out = next;
  }

  out = out.replace(
    /<p>\s*(<a\b[^>]*>[\s\S]*?<\/a>)\s*<\/p>\s*<p>(\s*['’]s|[,.;:!?])/gi,
    "<p>$1$2",
  );

  out = stripAnchorDisplayClasses(out);
  out = compactAnchorText(out);
  return collapsePunctuationSpacing(out);
}

export function sanitizeArticleBody(
  body: string,
  options: { title: string; coverImageUrl?: string | null },
) {
  let html = String(body || "").trim();
  if (!html) return "";

  if (options.coverImageUrl?.trim()) {
    html = stripCoverMatchingImages(html, options.coverImageUrl);
    html = stripImgsInOpeningWindow(html, 600);
  }

  html = stripLeadingChrome(html, options.title);
  html = html.replace(/\s*style\s*=\s*(["'])[\s\S]*?\1/gi, "");
  html = repairInlineAnchors(html);
  html = normalizeArticleHeadings(html);
  html = rewriteInternalArticleHrefs(html);
  return html;
}

const SITE_HOSTS = "(?:www\\.)?tradeflock(?:usa)?\\.(?:com|net|us)";
const DESK_SLUGS = "tech|technology|markets|leadership|finance|business|success-insights";
const DESK_PREFIX = new RegExp(
  `^(?:https?:\\/\\/${SITE_HOSTS})?\\/(${DESK_SLUGS})\\/([a-z0-9][a-z0-9-]*)\\/?$`,
  "i",
);

/** Map category-prefixed story URLs onto `/news/{slug}`. */
export function toNewsArticleHref(href: string) {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("mailto:")) return trimmed;

  const newsMatch = trimmed.match(
    new RegExp(`^(?:https?:\\/\\/${SITE_HOSTS})?\\/news\\/([a-z0-9][a-z0-9-]*)\\/?$`, "i"),
  );
  if (newsMatch?.[1]) return `/news/${newsMatch[1]}`;

  try {
    const url = new URL(trimmed, "https://www.tradeflock.net");
    const desk = `${url.pathname}`.replace(/\/+$/, "") || "/";
    const match = desk.match(new RegExp(`^\\/(${DESK_SLUGS})\\/([a-z0-9][a-z0-9-]*)$`, "i"));
    if (match?.[2]) return `/news/${match[2]}`;
  } catch {
    /* keep original */
  }

  const relative = trimmed.match(DESK_PREFIX);
  if (relative?.[2]) return `/news/${relative[2]}`;
  return trimmed;
}

export function rewriteInternalArticleHrefs(html: string) {
  return html.replace(/\bhref\s*=\s*(["'])([^"']*)\1/gi, (_full, quote: string, href: string) => {
    return `href=${quote}${toNewsArticleHref(href)}${quote}`;
  });
}

function headingTagForMarkdown(hashCount: number) {
  const level = Math.min(Math.max(hashCount + 1, 2), 6);
  return `h${level}`;
}

function convertMarkdownHeadings(html: string) {
  let out = html.replace(
    /<p>\s*(#{1,6})\s+([\s\S]*?)<\/p>/gi,
    (_full, hashes: string, inner: string) => {
      const tag = headingTagForMarkdown(hashes.length);
      return `<${tag}>${inner.trim()}</${tag}>`;
    },
  );
  out = out.replace(
    /(^|\n)(#{1,6})\s+([^\n<]+)/g,
    (_full, lead: string, hashes: string, title: string) => {
      const tag = headingTagForMarkdown(hashes.length);
      return `${lead}<${tag}>${title.trim()}</${tag}>`;
    },
  );
  return out;
}

function demoteHtmlH1(html: string) {
  return html.replace(/<h1(\b[^>]*)>/gi, "<h2$1>").replace(/<\/h1>/gi, "</h2>");
}

/** Page already has the story <h1>; body headings start at h2. */
export function normalizeArticleHeadings(html: string) {
  return demoteHtmlH1(convertMarkdownHeadings(html));
}
