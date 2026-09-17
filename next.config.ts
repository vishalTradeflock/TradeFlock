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
    ];
  },
  images: {
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
    ],
  },
};

export default nextConfig;
