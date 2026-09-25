import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "query", key: "category", value: "leadership" }],
        destination: "/leadership",
        permanent: false,
      },
      {
        source: "/",
        has: [{ type: "query", key: "category", value: "tech" }],
        destination: "/tech",
        permanent: false,
      },
      {
        source: "/",
        has: [{ type: "query", key: "category", value: "technology" }],
        destination: "/tech",
        permanent: false,
      },
      {
        source: "/",
        has: [{ type: "query", key: "category", value: "markets" }],
        destination: "/markets",
        permanent: false,
      },
      {
        source: "/",
        has: [{ type: "query", key: "category", value: "finance" }],
        destination: "/finance",
        permanent: false,
      },
      {
        source: "/",
        has: [{ type: "query", key: "category", value: "success-insights" }],
        destination: "/success-insights",
        permanent: false,
      },
      {
        source: "/news/:slug",
        destination: "/:slug",
        permanent: true,
      },
      {
        source: "/:category(tech|markets|leadership|finance|success-insights)/:slug",
        destination: "/:slug",
        permanent: true,
      },
      {
        source: "/:category(technology|business)/:slug",
        destination: "/:slug",
        permanent: true,
      },
      { source: "/technology", destination: "/tech", permanent: true },
    ];
  },
  images: {
    // Vercel image optimization returns 402 once the plan quota is exhausted,
    // which blanked covers site-wide. Serve every image from its own source.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "www.tradeflock.net",
      },
      {
        protocol: "https",
        hostname: "tradeflock.net",
      },
      {
        protocol: "https",
        hostname: "www.tradeflockusa.com",
      },
      {
        protocol: "https",
        hostname: "tradeflockusa.com",
      },
      {
        protocol: "https",
        hostname: "tradeflock.com",
      },
      {
        protocol: "https",
        hostname: "www.tradeflock.com",
      },
      {
        protocol: "https",
        hostname: "www.tradeflock.us",
      },
      {
        protocol: "https",
        hostname: "tradeflock.us",
      },
      {
        protocol: "https",
        hostname: "image.cnbcfm.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "techcrunch.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.techcrunch.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mmx.prnewswire.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.prnewswire.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "prnewswire.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
