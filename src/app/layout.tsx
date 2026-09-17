import type { Metadata } from "next";
import { Playfair_Display, Source_Sans_3 } from "next/font/google";
import { GlobalHeadScripts } from "@/components/GlobalHeadScripts";
import { JsonLd } from "@/components/JsonLd";
import SiteFooter from "@/components/SiteFooter";
import { getHeaderScripts, getSiteVerification } from "@/lib/site-settings";
import { siteStructuredData } from "@/lib/seo";
import { getBaseUrl } from "@/lib/site-url";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const verification = await getSiteVerification();
  return {
    metadataBase: new URL(getBaseUrl()),
    title: {
      default: "TradeFlock USA — Business & Markets",
      template: "%s | TradeFlock USA",
    },
    description:
      "U.S. business news on markets, technology, finance, and leadership. An editorial desk in the tradition of a national business paper.",
    // TEMPORARY: site-wide noindex while SEO is audited. Delete this `robots` field to restore indexing.
    robots: { index: false, follow: false },
    ...(verification.google || verification.bing
      ? {
          verification: {
            ...(verification.google ? { google: verification.google } : {}),
            ...(verification.bing ? { other: { "msvalidate.01": verification.bing } } : {}),
          },
        }
      : {}),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const headerScripts = await getHeaderScripts();

  return (
    <html
      lang="en"
      className={`${playfair.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white font-sans text-neutral-900">
        <JsonLd data={siteStructuredData()} />
        <GlobalHeadScripts scripts={headerScripts} />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
