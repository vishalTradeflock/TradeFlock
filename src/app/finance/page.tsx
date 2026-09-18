import type { Metadata } from "next";
import CategoryFeed from "@/components/CategoryFeed";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Finance",
  description:
    "Venture capital, private equity, corporate banking, and fiscal policy analysis.",
  path: "/finance",
});

export const revalidate = 120;

export default function FinancePage() {
  return (
    <CategoryFeed
      categoryTitle="Finance"
      categoryDescription="Venture capital, private equity, corporate banking, and fiscal policy analysis."
      categorySlug="finance"
    />
  );
}
