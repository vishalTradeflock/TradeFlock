import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NEW_YORK_TZ = "America/New_York";

export function formatDateline(date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: NEW_YORK_TZ,
  })
    .format(date)
    .toUpperCase();
}

export function newYorkEdition(date: Date = new Date()) {
  const rawHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: NEW_YORK_TZ,
      hour: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .find((part) => part.type === "hour")?.value ?? "0",
  );
  const hour = rawHour === 24 ? 0 : rawHour;
  if (hour >= 4 && hour < 12) return "MORNING EDITION";
  if (hour >= 12 && hour < 17) return "AFTERNOON EDITION";
  return "LATE EDITION";
}

export function formatMastheadDateline(date: Date = new Date()) {
  return `${formatDateline(date)} | NEW YORK | ${newYorkEdition(date)}`;
}

export function formatPublishedAt(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatTimeAgo(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(delta / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(iso);
}

export function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(iso));
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
