import { assessWireArticle, inferSourceFromBody } from "@/lib/agents/house-style";
import { loadRelatedCandidates } from "@/lib/agents/related-articles";

export async function studioPublishFailures(input: {
  title: string;
  slug: string;
  html: string;
  categorySlug: string;
  excludeSlug?: string;
}): Promise<string[]> {
  const related = await loadRelatedCandidates({
    topic: input.title,
    category: input.categorySlug,
    excludeSlug: input.excludeSlug ?? input.slug,
  });
  const inferred = inferSourceFromBody(input.html);
  const assessment = assessWireArticle({
    title: input.title,
    slug: input.slug,
    html: input.html,
    notes: inferred,
    rawSource: "",
    related,
    factCheck: "calendar",
  });
  return assessment.failures;
}
