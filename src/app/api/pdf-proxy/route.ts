import { NextRequest } from "next/server";
import { isAllowedPdfHost } from "@/lib/pdf-proxy";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers":
    "Accept-Ranges, Content-Length, Content-Range, Content-Type",
};

function corsHeaders(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", CORS_HEADERS["Access-Control-Allow-Origin"]);
  headers.set("Access-Control-Allow-Methods", CORS_HEADERS["Access-Control-Allow-Methods"]);
  headers.set("Access-Control-Allow-Headers", CORS_HEADERS["Access-Control-Allow-Headers"]);
  headers.set("Access-Control-Expose-Headers", CORS_HEADERS["Access-Control-Expose-Headers"]);
  return headers;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing target URL", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    return new Response("Invalid target URL", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  if (target.protocol !== "https:" || !isAllowedPdfHost(target.hostname)) {
    return new Response("Host not allowed", {
      status: 403,
      headers: CORS_HEADERS,
    });
  }

  try {
    const upstreamHeaders: HeadersInit = {
      Accept: "application/pdf,*/*",
      "Accept-Encoding": "identity",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    // Forward range headers so PDF.js can stream individual pages on demand
    const range = req.headers.get("range");
    if (range) {
      upstreamHeaders.Range = range;
    }

    const response = await fetch(target.toString(), {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: upstreamHeaders,
    });

    if (!response.ok && response.status !== 206) {
      return new Response(`Upstream error: ${response.statusText}`, {
        status: response.status,
        headers: CORS_HEADERS,
      });
    }

    const responseHeaders = new Headers(response.headers);
    corsHeaders(responseHeaders);
    responseHeaders.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    if (!responseHeaders.get("Accept-Ranges")) {
      responseHeaders.set("Accept-Ranges", "bytes");
    }
    responseHeaders.delete("content-encoding");

    return new Response(req.method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy Error";
    return new Response(message, { status: 500, headers: CORS_HEADERS });
  }
}

export const HEAD = GET;
