export type StudioFaq = {
  question: string;
  answer: string;
};

const ANSWER_MAX = 4_000;
const QUESTION_MAX = 300;

export function sanitizeFaqAnswer(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let html = trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<\/?(?:html|head|body|iframe|object|embed|link|meta)[^>]*>/gi, "");

  html = html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    const allowed = new Set(["p", "br", "strong", "em", "b", "i", "a", "ul", "ol", "li"]);
    if (!allowed.has(name)) return "";
    if (name === "br") return "<br />";
    const closing = full.startsWith("</");
    if (closing) return `</${name}>`;
    if (name === "a") {
      const href = attrs.match(/\bhref\s*=\s*(["'])([^"']*)\1/i)?.[2]?.trim() ?? "";
      if (!href || /^(javascript|data):/i.test(href)) return "<a>";
      const safe = href.startsWith("/") || href.startsWith("https://") || href.startsWith("http://") || href.startsWith("#");
      return safe ? `<a href="${href.replace(/"/g, "")}">` : "<a>";
    }
    return `<${name}>`;
  });

  return html.replace(/\s+/g, " ").trim().slice(0, ANSWER_MAX);
}

export function faqAnswerPlainText(raw: string) {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeStudioFaqs(raw: unknown): StudioFaq[] {
  const prepared = prepareStudioFaqs(raw);
  return prepared.ok ? prepared.faqs : [];
}

export function prepareStudioFaqs(
  raw: unknown,
): { ok: true; faqs: StudioFaq[] } | { ok: false; error: string } {
  if (raw == null) return { ok: true, faqs: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "FAQs must be a list of questions and answers." };
  }
  const faqs: StudioFaq[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const question = String(row.question ?? "").replace(/\s+/g, " ").trim().slice(0, QUESTION_MAX);
    const answer = sanitizeFaqAnswer(String(row.answer ?? ""));
    if (!question && !answer) continue;
    if (!question || !answer) continue;
    faqs.push({ question, answer });
  }
  return { ok: true, faqs };
}
