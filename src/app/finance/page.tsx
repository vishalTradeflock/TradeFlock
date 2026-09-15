import type { Metadata } from "next";
import CategoryFeed from "@/components/CategoryFeed";

export const metadata: Metadata = {
  title: "Finance",
  description:
    "Venture capital, private equity, corporate banking, and fiscal policy analysis.",
  openGraph: {
    title: "Finance | TradeFlock USA",
    description:
      "Venture capital, private equity, corporate banking, and fiscal policy analysis.",
    type: "website",
  },
};

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
