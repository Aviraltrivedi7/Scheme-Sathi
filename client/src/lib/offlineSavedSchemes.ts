import type { Scheme } from "@/lib/schemes";

export const offlineSavedSchemesStorageKey = "scheme-sathi-offline-saved-v1";

export type OfflineSavedSchemesSnapshot = {
  version: 1;
  savedAt: number;
  schemes: Scheme[];
};

export type OfflineSavedSchemesSort = "saved" | "deadlineAsc";

/** Upcoming deadlines come first; schemes without a deadline follow, then closed schemes. Within equal groups, snapshot order stays stable. */
export function sortOfflineSavedSchemes(schemes: Scheme[], sort: OfflineSavedSchemesSort, now = Date.now()) {
  if (sort === "saved") return schemes;
  return schemes.map((scheme, index) => ({ scheme, index })).sort((left, right) => {
    const rank = (item: Scheme) => !item.applicationDeadline ? 1 : item.applicationDeadline > now ? 0 : 2;
    const leftRank = rank(left.scheme);
    const rightRank = rank(right.scheme);
    if (leftRank !== rightRank) return leftRank - rightRank;
    if (leftRank === 0 && left.scheme.applicationDeadline !== right.scheme.applicationDeadline) return left.scheme.applicationDeadline! - right.scheme.applicationDeadline!;
    return left.index - right.index;
  }).map(item => item.scheme);
}

/** Stores only public scheme guidance, never account, profile, note, or session data. */
export function createOfflineSavedSchemesSnapshot(
  catalog: Scheme[],
  savedIds: string[],
  savedAt = Date.now()
): OfflineSavedSchemesSnapshot {
  const savedIdSet = new Set(savedIds);
  return {
    version: 1,
    savedAt,
    schemes: catalog.filter(scheme => savedIdSet.has(scheme.id)),
  };
}

export function readOfflineSavedSchemesSnapshot(storage: Pick<Storage, "getItem">): OfflineSavedSchemesSnapshot | null {
  try {
    const raw = storage.getItem(offlineSavedSchemesStorageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const snapshot = parsed as Partial<OfflineSavedSchemesSnapshot>;
    if (snapshot.version !== 1 || typeof snapshot.savedAt !== "number" || !Array.isArray(snapshot.schemes)) return null;
    if (snapshot.schemes.some(scheme => !scheme || typeof scheme.id !== "string" || typeof scheme.name !== "string" || typeof scheme.portalUrl !== "string")) return null;
    return snapshot as OfflineSavedSchemesSnapshot;
  } catch {
    return null;
  }
}

export function writeOfflineSavedSchemesSnapshot(storage: Pick<Storage, "setItem">, snapshot: OfflineSavedSchemesSnapshot) {
  try {
    storage.setItem(offlineSavedSchemesStorageKey, JSON.stringify(snapshot));
  } catch {
    // QuotaExceeded / private-mode: caller keeps the in-memory snapshot;
    // offline favourites simply won't persist this session.
  }
}
