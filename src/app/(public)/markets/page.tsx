import type { Metadata } from "next";
import CategoryFeed from "@/components/CategoryFeed";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Markets",
  description:
    "Macro trends, market intelligence, global trade movements, and industry shifts.",
  path: "/markets",
});

export const revalidate = 120;

export default function MarketsPage() {
  return (
    <CategoryFeed
      categoryTitle="Markets"
      categoryDescription="Macro trends, market intelligence, global trade movements, and industry shifts."
      categorySlug="markets"
    />
  );
}
