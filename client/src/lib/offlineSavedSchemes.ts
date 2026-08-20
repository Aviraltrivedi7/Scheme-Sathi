import type { Scheme } from "@/lib/schemes";

export const offlineSavedSchemesStorageKey = "scheme-sathi-offline-saved-v1";

export type OfflineSavedSchemesSnapshot = {
  version: 1;
  savedAt: number;
  schemes: Scheme[];
};

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
  storage.setItem(offlineSavedSchemesStorageKey, JSON.stringify(snapshot));
}
