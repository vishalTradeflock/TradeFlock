import { NextRequest, NextResponse } from "next/server";
import { magazineDownloadFilename } from "@/lib/magazine-download";
import { getMagazineBySlug } from "@/lib/magazines";
import { isAllowedPdfHost } from "@/lib/pdf-proxy";

export const runtime = "nodejs";
export const maxDuration = 60;

function contentDisposition(filename: string) {
  return `attachment; filename="${filename}"`;
}

function resolvePdfUrl(pdfUrl: string, origin: string): URL | null {
  try {
    const url = pdfUrl.startsWith("/") ? new URL(pdfUrl, origin) : new URL(pdfUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const localHost = new URL(origin).hostname;
    if (url.hostname === localHost) return url;
    if (url.protocol === "https:" && isAllowedPdfHost(url.hostname)) return url;
    return null;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const magazine = await getMagazineBySlug(slug);
  if (!magazine?.pdf_url) {
    return new NextResponse("Magazine PDF not found", { status: 404 });
  }

  const target = resolvePdfUrl(magazine.pdf_url, req.nextUrl.origin);
  if (!target) {
    return new NextResponse("Magazine PDF not found", { status: 404 });
  }

  const upstream = await fetch(target.toString(), {
    headers: {
      Accept: "application/pdf,*/*",
      "Accept-Encoding": "identity",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Magazine PDF not found", {
      status: upstream.status === 404 ? 404 : 502,
    });
  }

  const filename = magazineDownloadFilename(magazine.title, magazine.slug);
  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", contentDisposition(filename));
  headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  const length = upstream.headers.get("Content-Length");
  if (length) headers.set("Content-Length", length);

  return new NextResponse(upstream.body, { status: 200, headers });
}
