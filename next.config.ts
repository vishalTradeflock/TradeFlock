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
  async redirects() {
    return [
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
};

export default nextConfig;
