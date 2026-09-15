import type { Metadata } from "next";
import CategoryFeed from "@/components/CategoryFeed";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Macro trends, market intelligence, global trade movements, and industry shifts.",
  openGraph: {
    title: "Markets | TradeFlock USA",
    description:
      "Macro trends, market intelligence, global trade movements, and industry shifts.",
    type: "website",
  },
};

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
