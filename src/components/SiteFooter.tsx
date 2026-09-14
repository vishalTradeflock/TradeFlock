"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/magazine/") && pathname !== "/magazine") {
    return null;
  }
  return <Footer />;
}
