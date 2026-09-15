"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function SiteFooter() {
  const pathname = usePathname();
  if (/^\/magazine\/[^/]+\/read\/?$/.test(pathname)) {
    return null;
  }
  return <Footer />;
}
