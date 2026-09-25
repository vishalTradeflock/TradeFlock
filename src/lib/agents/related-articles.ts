export type RelatedCandidate = {
  slug: string;
  title: string;
};

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "for", "to", "in", "on", "at", "by",
  "with", "from", "as", "after", "amid", "over", "into", "its", "that", "this",
  "be", "is", "are", "was", "were", "will", "has", "have", "had", "not", "than",
  "about", "their", "they", "his", "her", "who", "what", "when", "where",
]);

const SECTION_BY_DESK: Record<string, string> = {
  tech: "tech",
  technology: "tech",
  markets: "markets",
  market: "markets",
  ma: "finance",
  finance: "finance",
  strategy: "leadership",
  leadership: "leadership",
  macro: "markets",
  retail: "finance",
  "success-insights": "success-insights",
};

export function topicKeywords(topic: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const word of topic.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)) {
    if (word.length < 4 || STOP_WORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    keywords.push(word);
    if (keywords.length >= 8) break;
  }
  return keywords;
}

export function rankRelatedCandidates(
  candidates: readonly RelatedCandidate[],
  topic: string,
  limit = 6,
  excludeSlug?: string,
): RelatedCandidate[] {
  const keywords = topicKeywords(topic);
  const exclude = excludeSlug?.trim().toLowerCase() ?? "";
  const scored = candidates
    .filter((candidate) => candidate.slug && candidate.slug.toLowerCase() !== exclude)
    .map((candidate) => {
      const title = candidate.title.toLowerCase();
      const score = keywords.reduce(
        (total, word) => total + (title.includes(word) ? 1 : 0),
        0,
      );
      return { candidate, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.candidate.slug.localeCompare(right.candidate.slug));

  const picked: RelatedCandidate[] = [];
  const seen = new Set<string>();
  for (const item of scored) {
    if (seen.has(item.candidate.slug)) continue;
    seen.add(item.candidate.slug);
    picked.push({ slug: item.candidate.slug, title: item.candidate.title });
    if (picked.length >= limit) break;
  }
  return picked;
}

export function formatRelatedCandidates(candidates: readonly RelatedCandidate[]): string {
  if (!candidates.length) {
    return "No related TradeFlock articles matched this story. Do not invent internal links.";
  }
  const lines = candidates.map(
    (candidate) => `- <a href="/${candidate.slug}">${candidate.title}</a>`,
  );
  return `Candidate internal links (weave at least 2 into sentences when 2 or more are listed; copy these hrefs exactly; do not invent slugs; do not paste a bare link list):\n${lines.join("\n")}`;
}

function sectionSlug(category: string): string | null {
  const key = category.trim().toLowerCase();
  return SECTION_BY_DESK[key] ?? (key || null);
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "");
}

type ArticleHit = { slug: string; title: string; magazine_id?: string | null };

function asHits(value: unknown): ArticleHit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as { slug?: unknown; title?: unknown; magazine_id?: unknown };
    const slug = typeof record.slug === "string" ? record.slug.trim() : "";
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!slug || !title || record.magazine_id) return [];
    return [{ slug, title }];
  });
}

export async function loadRelatedCandidates(input: {
  topic: string;
  category: string;
  excludeSlug?: string;
  limit?: number;
}): Promise<RelatedCandidate[]> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const section = sectionSlug(input.category);
    const keywords = topicKeywords(input.topic).slice(0, 2).map(escapeIlike).filter(Boolean);
    const hits: ArticleHit[] = [];

    if (section) {
      const category = await admin.from("categories").select("id").eq("slug", section).maybeSingle();
      if (category.data?.id) {
        const recent = await admin
          .from("articles")
          .select("slug, title, magazine_id")
          .eq("status", "published")
          .eq("category_id", category.data.id)
          .order("published_at", { ascending: false })
          .limit(40);
        hits.push(...asHits(recent.data));
      }
    }

    const keywordHits = await Promise.all(
      keywords.map(async (word) => {
        const rows = await admin
          .from("articles")
          .select("slug, title, magazine_id")
          .eq("status", "published")
          .ilike("title", `%${word}%`)
          .order("published_at", { ascending: false })
          .limit(15);
        return asHits(rows.data);
      }),
    );
    for (const batch of keywordHits) hits.push(...batch);

    return rankRelatedCandidates(hits, input.topic, input.limit ?? 6, input.excludeSlug);
  } catch (err) {
    const message = err instanceof Error ? err.message : "related lookup failed";
    console.error(`[related] ${message}`);
    return [];
  }
}
