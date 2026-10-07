import type { Metadata } from "next";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Playfair_Display, Source_Sans_3 } from "next/font/google";
import { JsonLd } from "@/components/JsonLd";
import SiteFooter from "@/components/SiteFooter";
import { getSiteVerification } from "@/lib/site-settings";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white font-sans text-neutral-900">
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-DQXYWQ2FME"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-DQXYWQ2FME', { page_path: window.location.pathname });`,
          }}
        />
        <JsonLd data={siteStructuredData()} />
        {children}
        <SiteFooter />
        <SpeedInsights />
      </body>
    </html>
  );
}
