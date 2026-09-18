import type { Metadata } from "next";
import { headers } from "next/headers";
import { Playfair_Display, Source_Sans_3 } from "next/font/google";
import { GlobalHeadCode } from "@/components/GlobalHeadCode";
import { GlobalHeadScripts } from "@/components/GlobalHeadScripts";
import { JsonLd } from "@/components/JsonLd";
import SiteFooter from "@/components/SiteFooter";
import { shouldInjectGlobalHead } from "@/lib/public-head";
import { getGlobalHeadCode, getHeaderScripts, getSiteVerification } from "@/lib/site-settings";
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
    verification: {
      google: "IrQMJyoqG0OnLHEKbgRVcRhTppWDcarmEZCMgi0r99E",
      ...(verification.bing ? { other: { "msvalidate.01": verification.bing } } : {}),
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const headerList = await headers();
  const injectPublicHead = shouldInjectGlobalHead(headerList.get("x-tradeflock-path"));
  const [headerScripts, globalHeadCode] = await Promise.all([
    injectPublicHead ? getHeaderScripts() : Promise.resolve([]),
    injectPublicHead ? getGlobalHeadCode() : Promise.resolve(""),
  ]);

  return (
    <html
      lang="en"
      className={`${playfair.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <head>{injectPublicHead ? <GlobalHeadCode html={globalHeadCode} /> : null}</head>
      <body className="flex min-h-full flex-col bg-white font-sans text-neutral-900">
        <JsonLd data={siteStructuredData()} />
        {injectPublicHead ? <GlobalHeadScripts scripts={headerScripts} /> : null}
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
