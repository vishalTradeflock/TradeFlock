"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function SiteFooter() {
  const pathname = usePathname();
  if (
    /^\/magazine\/[^/]+\/read\/?$/.test(pathname) ||
    pathname === "/studio" ||
    pathname.startsWith("/studio/")
  ) {
    return null;
  }
  return <Footer />;
}
