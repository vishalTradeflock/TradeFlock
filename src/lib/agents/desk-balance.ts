import { WRITER_DESKS, type WriterDesk } from "@/lib/agents/prompts";

/**
 * Least-recently-used desks first so a busy tech feed cannot occupy every slot
 * when other desks also have fresh copy. `recentDesks` is most-recent-first.
 */
export function deskPreferenceOrder(recentDesks: readonly WriterDesk[]): WriterDesk[] {
  const lastSeen = new Map<WriterDesk, number>();
  recentDesks.forEach((desk, index) => {
    if (!lastSeen.has(desk)) lastSeen.set(desk, index);
  });

  return [...WRITER_DESKS].sort((a, b) => {
    const aSeen = lastSeen.get(a) ?? Number.POSITIVE_INFINITY;
    const bSeen = lastSeen.get(b) ?? Number.POSITIVE_INFINITY;
    if (aSeen !== bSeen) return bSeen - aSeen;
    return WRITER_DESKS.indexOf(a) - WRITER_DESKS.indexOf(b);
  });
}

export function pickBalancedLeads<T extends { desk: WriterDesk }>(
  fresh: readonly T[],
  limit: number,
  recentDesks: readonly WriterDesk[],
): T[] {
  const cap = Math.max(1, limit);
  const buckets = new Map<WriterDesk, T[]>(WRITER_DESKS.map((desk) => [desk, []]));
  for (const item of fresh) {
    buckets.get(item.desk)?.push(item);
  }

  const order = deskPreferenceOrder(recentDesks);
  const picked: T[] = [];
  let progressed = true;
  while (picked.length < cap && progressed) {
    progressed = false;
    for (const desk of order) {
      const next = buckets.get(desk)?.shift();
      if (!next) continue;
      picked.push(next);
      progressed = true;
      if (picked.length >= cap) break;
    }
  }
  return picked;
}
