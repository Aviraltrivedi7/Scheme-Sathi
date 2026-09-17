export type ArchivedPilotDashboardViewBackup = {
  id: number;
  name: string;
  filters: {
    from: string;
    to: string;
    segment: "all" | "college" | "ngo";
    view: "month" | "quarter";
  };
  folder: string | null;
  folderColor: string | null;
  archivedAt: number | null;
  updatedAt: number;
  isArchived: boolean;
};

export type PilotDashboardArchiveFolderColor = "saffron" | "marigold" | "teal" | "indigo" | "plum" | "slate";

export type PilotDashboardArchiveImportView = {
  name: string;
  filters: ArchivedPilotDashboardViewBackup["filters"];
  folder: string | null;
  folderColor: PilotDashboardArchiveFolderColor | null;
};

type ArchivedBackupFileView = PilotDashboardArchiveImportView & {
  id: number;
  archivedAt: number | null;
  updatedAt: number;
};

export const pilotDashboardArchiveBackupFormat = "scheme-sathi-archived-dashboard-views-v1";
const pilotDashboardArchiveBackupScope = "administrator-private archived dashboard views";
const pilotDashboardArchiveBackupVersion = "v1" as const;
const pilotDashboardArchiveViewLimit = 20;

export type PilotDashboardArchiveBackupIntegrity = {
  formatVersion: typeof pilotDashboardArchiveBackupVersion;
  status: "verified" | "legacy";
  algorithm: "SHA-256" | null;
  digest: string | null;
};

export type ParsedPilotDashboardArchiveBackup = {
  views: PilotDashboardArchiveImportView[];
  integrity: PilotDashboardArchiveBackupIntegrity;
  exportedAt: number;
};

export type PilotDashboardArchiveRestorePreview = {
  canRestore: boolean;
  existingViewCount: number;
  importedViewCount: number;
  remainingSlots: number;
  conflicts: { sourceName: string; restoredName: string }[];
  views: Array<PilotDashboardArchiveImportView & { restoredName: string; hasNameConflict: boolean }>;
};

const allowedFolderColors = new Set<PilotDashboardArchiveFolderColor>([
  "saffron",
  "marigold",
  "teal",
  "indigo",
  "plum",
  "slate",
]);

function isPilotDashboardArchiveFolderColor(value: string): value is PilotDashboardArchiveFolderColor {
  return allowedFolderColors.has(value as PilotDashboardArchiveFolderColor);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseArchivedBackupView(value: unknown): PilotDashboardArchiveImportView {
  if (!isRecord(value) || typeof value.name !== "string" || !isRecord(value.filters)) {
    throw new Error("This backup contains an invalid archived dashboard view.");
  }
  const name = value.name.trim();
  const { from, to, segment, view } = value.filters;
  if (!name || name.length > 60 || typeof from !== "string" || typeof to !== "string" || (segment !== "all" && segment !== "college" && segment !== "ngo") || (view !== "month" && view !== "quarter")) {
    throw new Error("This backup contains an invalid dashboard filter configuration.");
  }
  const folder = typeof value.folder === "string" ? value.folder.trim() || null : value.folder === null ? null : null;
  if (folder && folder.length > 40) throw new Error("This backup contains a folder name that is too long.");
  const folderColor = typeof value.folderColor === "string" ? value.folderColor : null;
  if (folderColor && !isPilotDashboardArchiveFolderColor(folderColor)) {
    throw new Error("This backup contains an unsupported folder color.");
  }
  return { name, filters: { from, to, segment, view }, folder, folderColor: folderColor as PilotDashboardArchiveFolderColor | null };
}

function parseArchivedBackupFileView(value: unknown): ArchivedBackupFileView {
  if (!isRecord(value) || !Number.isInteger(value.id) || (value.id as number) <= 0 || !isSafeTimestamp(value.updatedAt) || (value.archivedAt !== null && !isSafeTimestamp(value.archivedAt))) {
    throw new Error("This backup contains invalid archived-view metadata.");
  }
  return { ...parseArchivedBackupView(value), id: value.id as number, archivedAt: value.archivedAt as number | null, updatedAt: value.updatedAt as number };
}

function archivePayload(views: ArchivedBackupFileView[], exportedAt: number) {
  return {
    format: pilotDashboardArchiveBackupFormat,
    exportedAt,
    scope: pilotDashboardArchiveBackupScope,
    views: views.map(({ id, name, filters, folder, folderColor, archivedAt, updatedAt }) => ({
      id,
      name,
      filters,
      folder,
      folderColor,
      archivedAt,
      updatedAt,
    })),
  };
}

function canonicalArchivePayload(views: ArchivedBackupFileView[], exportedAt: number) {
  return JSON.stringify(archivePayload(views, exportedAt));
}

async function sha256Hex(contents: string) {
  if (!globalThis.crypto?.subtle) throw new Error("This browser cannot verify archived backup integrity.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(contents));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function restoredPilotDashboardViewName(name: string, usedNames: Set<string>) {
  const source = name.trim() || "Saved view";
  if (!usedNames.has(source)) return source;
  let counter = 1;
  while (counter <= 99) {
    const suffix = counter === 1 ? " (restored)" : ` (restored ${counter})`;
    const candidate = `${source.slice(0, Math.max(1, 60 - suffix.length)).trim()}${suffix}`;
    if (!usedNames.has(candidate)) return candidate;
    counter += 1;
  }
  throw new Error("Unable to create a unique restored dashboard view name.");
}

/** Builds a local-only restore plan that mirrors the server's collision-safe name behavior. */
export function createPilotDashboardArchiveRestorePreview(
  importedViews: PilotDashboardArchiveImportView[],
  existingViewNames: string[]
): PilotDashboardArchiveRestorePreview {
  const usedNames = new Set(existingViewNames);
  const views = importedViews.map(view => {
    const hasNameConflict = usedNames.has(view.name);
    const restoredName = restoredPilotDashboardViewName(view.name, usedNames);
    usedNames.add(restoredName);
    return { ...view, restoredName, hasNameConflict };
  });
  const existingViewCount = existingViewNames.length;
  const importedViewCount = importedViews.length;
  return {
    canRestore: existingViewCount + importedViewCount <= pilotDashboardArchiveViewLimit,
    existingViewCount,
    importedViewCount,
    remainingSlots: Math.max(0, pilotDashboardArchiveViewLimit - existingViewCount - importedViewCount),
    conflicts: views.filter(view => view.hasNameConflict).map(({ name, restoredName }) => ({ sourceName: name, restoredName })),
    views,
  };
}

/** Reads Scheme Sathi archived-view JSON, verifies modern checksums, and strips non-restorable fields. */
export async function parsePilotDashboardArchiveBackup(contents: string): Promise<ParsedPilotDashboardArchiveBackup> {
  let payload: unknown;
  try {
    payload = JSON.parse(contents);
  } catch {
    throw new Error("Choose a valid Scheme Sathi archived-view JSON backup.");
  }
  if (!isRecord(payload) || payload.format !== pilotDashboardArchiveBackupFormat || payload.scope !== pilotDashboardArchiveBackupScope || !isSafeTimestamp(payload.exportedAt) || !Array.isArray(payload.views)) {
    throw new Error("Choose a Scheme Sathi archived-view JSON backup.");
  }
  if (!payload.views.length || payload.views.length > pilotDashboardArchiveViewLimit) {
    throw new Error("A backup must contain between 1 and 20 archived views.");
  }
  const fileViews = payload.views.map(parseArchivedBackupFileView);
  let integrity: PilotDashboardArchiveBackupIntegrity = {
    formatVersion: pilotDashboardArchiveBackupVersion,
    status: "legacy",
    algorithm: null,
    digest: null,
  };
  if (payload.integrity !== undefined) {
    if (!isRecord(payload.integrity) || payload.integrity.algorithm !== "SHA-256" || typeof payload.integrity.digest !== "string" || !/^[a-f0-9]{64}$/i.test(payload.integrity.digest)) {
      throw new Error("This archived backup has invalid integrity metadata.");
    }
    const digest = payload.integrity.digest.toLowerCase();
    const expectedDigest = await sha256Hex(canonicalArchivePayload(fileViews, payload.exportedAt));
    if (digest !== expectedDigest) {
      throw new Error("Archived backup integrity check failed. Choose the original, unmodified JSON file.");
    }
    integrity = {
      formatVersion: pilotDashboardArchiveBackupVersion,
      status: "verified",
      algorithm: "SHA-256",
      digest,
    };
  }
  return { views: fileViews.map(({ id: _id, archivedAt: _archivedAt, updatedAt: _updatedAt, ...view }) => view), integrity, exportedAt: payload.exportedAt };
}

/** Produces a browser-local, versioned backup with a SHA-256 accidental-corruption check. */
export async function createPilotDashboardArchiveBackup(
  views: ArchivedPilotDashboardViewBackup[],
  exportedAt = Date.now()
) {
  const archivedViews: ArchivedBackupFileView[] = views
    .filter(view => view.isArchived)
    .map(({ id, name, filters, folder, folderColor, archivedAt, updatedAt }) => ({
      id,
      name,
      filters,
      folder,
      folderColor: folderColor as PilotDashboardArchiveFolderColor | null,
      archivedAt,
      updatedAt,
    }));
  const payload = archivePayload(archivedViews, exportedAt);
  const integrity = {
    algorithm: "SHA-256" as const,
    digest: await sha256Hex(canonicalArchivePayload(archivedViews, exportedAt)),
  };
  const date = new Date(exportedAt).toISOString().slice(0, 10);
  return {
    fileName: `scheme-sathi-archived-dashboard-views-${date}.json`,
    contents: `${JSON.stringify({ ...payload, integrity }, null, 2)}\n`,
  };
}
