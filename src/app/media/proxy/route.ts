import dns from "node:dns/promises";
import { NextRequest, NextResponse } from "next/server";
import {
  MEDIA_PROXY_MAX_BYTES,
  MEDIA_PROXY_MAX_REDIRECTS,
  MEDIA_PROXY_TIMEOUT_MS,
  isAllowedImageContentType,
  isBlockedHostname,
  isBlockedIp,
  parseExternalImageUrl,
} from "@/lib/media-proxy";
import { OG_COVER_WIDTH, resizedCoverUrl } from "@/lib/responsive-cover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "set-cookie",
  "cookie",
  "www-authenticate",
  "server",
  "x-powered-by",
  "x-cache",
  "via",
];

async function assertPublicHttpUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("blocked");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error("blocked");
  }
  const looked = await dns.lookup(url.hostname, { all: true });
  if (!looked.length) throw new Error("blocked");
  for (const record of looked) {
    if (isBlockedIp(record.address) || isBlockedHostname(record.address)) {
      throw new Error("blocked");
    }
  }
}

async function fetchImage(start: URL) {
  let current = start;
  for (let hop = 0; hop <= MEDIA_PROXY_MAX_REDIRECTS; hop += 1) {
    await assertPublicHttpUrl(current);
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(MEDIA_PROXY_TIMEOUT_MS),
      headers: {
        Accept: "image/jpeg,image/png,image/webp,image/gif,image/avif,image/*;q=0.8",
        "User-Agent": "TradeFlockUSA-ImageProxy/1.0",
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return { error: "redirect" as const };
      current = new URL(location, current);
      continue;
    }

    return { response };
  }
  return { error: "redirect" as const };
}

function reject(status: number) {
  return new NextResponse(null, {
    status,
    headers: {
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

type Loaded =
  | { ok: true; buffer: ArrayBuffer; contentType: string }
  | { ok: false; status: number; tooBig?: boolean };

async function loadImage(start: URL): Promise<Loaded> {
  const result = await fetchImage(start);
  if ("error" in result) return { ok: false, status: 400 };
  const { response } = result;
  if (!response.ok) return { ok: false, status: 404 };

  const contentType = response.headers.get("content-type");
  if (!isAllowedImageContentType(contentType)) return { ok: false, status: 415 };

  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MEDIA_PROXY_MAX_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false, status: 413, tooBig: true };
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > MEDIA_PROXY_MAX_BYTES) {
    return { ok: false, status: 413, tooBig: true };
  }

  return {
    ok: true,
    buffer,
    contentType: (contentType ?? "image/jpeg").split(";")[0] ?? "image/jpeg",
  };
}

function imageResponse(buffer: ArrayBuffer, contentType: string) {
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Length", String(buffer.byteLength));
  for (const name of HOP_BY_HOP) headers.delete(name);
  return new NextResponse(buffer, { status: 200, headers });
}

/** ~1200w source variant when this host can shrink an oversized original. */
function smallerProxySource(original: URL): URL | null {
  const next = resizedCoverUrl(original.toString(), OG_COVER_WIDTH);
  if (!next) return null;
  const parsed = parseExternalImageUrl(next);
  if (!parsed || parsed.href === original.href) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("src") ?? "";
  const target = parseExternalImageUrl(raw);
  if (!target) return reject(400);

  try {
    const first = await loadImage(target);
    if (first.ok) return imageResponse(first.buffer, first.contentType);
    if (first.tooBig) {
      const smaller = smallerProxySource(target);
      if (smaller) {
        const second = await loadImage(smaller);
        if (second.ok) return imageResponse(second.buffer, second.contentType);
      }
      return reject(413);
    }
    return reject(first.status);
  } catch {
    return reject(502);
  }
}
