import { getBaseUrl } from "./site-url.ts";

export const MEDIA_PROXY_PATH = "/media/proxy";
export const MEDIA_PROXY_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_PROXY_TIMEOUT_MS = 5_000;
export const MEDIA_PROXY_MAX_REDIRECTS = 3;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.internal",
  "instance-data",
]);

function hostnameOf(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function isFirstPartyMediaHost(hostname: string) {
  const host = hostnameOf(hostname);
  return host === "www.tradeflock.net" || host === "tradeflock.net";
}

function ipv4ToInt(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipv4InCidr(ip: string, cidr: string) {
  const [base, bitsRaw] = cidr.split("/");
  const ipInt = ipv4ToInt(ip);
  const baseInt = base ? ipv4ToInt(base) : null;
  const bits = Number(bitsRaw);
  if (ipInt == null || baseInt == null || !Number.isInteger(bits)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

export function isBlockedIpv4(ip: string) {
  const ranges = [
    "0.0.0.0/8",
    "10.0.0.0/8",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "192.0.2.0/24",
    "198.51.100.0/24",
    "203.0.113.0/24",
    "224.0.0.0/4",
    "255.255.255.255/32",
  ];
  return ranges.some((cidr) => ipv4InCidr(ip, cidr));
}

export function isBlockedIpv6(ip: string) {
  const host = hostnameOf(ip);
  if (host === "::" || host === "::1") return true;
  if (host.startsWith("fe80:") || host.startsWith("fec0:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }
  const v4mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4mapped?.[1]) return isBlockedIpv4(v4mapped[1]);
  return false;
}

export function isBlockedIp(ip: string) {
  const host = hostnameOf(ip);
  if (host.includes(".")) return isBlockedIpv4(host);
  return isBlockedIpv6(host);
}

export function isBlockedHostname(hostname: string) {
  const host = hostnameOf(hostname);
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") return true;
  if (host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return true;
  if (isBlockedIp(host)) return true;
  return false;
}

export function parseExternalImageUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2_000) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.username || parsed.password) return null;
    if (isBlockedHostname(parsed.hostname)) return null;
    if (!parsed.hostname.includes(".") && !parsed.hostname.includes(":")) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isAllowedImageContentType(value: string | null | undefined) {
  const type = (value ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_IMAGE_TYPES.has(type);
}

export function mediaProxyPath(sourceUrl: string) {
  return `${MEDIA_PROXY_PATH}?src=${encodeURIComponent(sourceUrl)}`;
}

function origin() {
  return getBaseUrl();
}

export function isAlreadyProxied(url: string) {
  try {
    const parsed = new URL(url, origin());
    return parsed.pathname === MEDIA_PROXY_PATH;
  } catch {
    return false;
  }
}

/**
 * Convert an external image source into a first-party TradeFlock URL when needed.
 * Leaves first-party and already-proxied URLs unchanged. Does not rewrite the DB.
 */
export function firstPartyMediaUrl(source: string | null | undefined): string | null {
  const trimmed = source?.trim() ?? "";
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) {
    return firstPartyMediaUrl(`https:${trimmed}`);
  }

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith(MEDIA_PROXY_PATH)) return `${origin()}${trimmed}`;
    return `${origin()}${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (isFirstPartyMediaHost(parsed.hostname)) {
      return parsed.toString();
    }
    if (isAlreadyProxied(parsed.toString())) return parsed.toString();
    const safe = parseExternalImageUrl(parsed.toString());
    if (!safe) return null;
    return `${origin()}${mediaProxyPath(safe.toString())}`;
  } catch {
    return null;
  }
}
