import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
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
