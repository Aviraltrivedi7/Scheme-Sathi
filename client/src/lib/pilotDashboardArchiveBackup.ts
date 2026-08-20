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

/** Reads only Scheme Sathi's own local archive format and strips all non-restorable fields. */
export function parsePilotDashboardArchiveBackup(contents: string) {
  let payload: unknown;
  try {
    payload = JSON.parse(contents);
  } catch {
    throw new Error("Choose a valid Scheme Sathi archived-view JSON backup.");
  }
  if (!isRecord(payload) || payload.format !== "scheme-sathi-archived-dashboard-views-v1" || !Array.isArray(payload.views)) {
    throw new Error("Choose a Scheme Sathi archived-view JSON backup.");
  }
  if (!payload.views.length || payload.views.length > 20) {
    throw new Error("A backup must contain between 1 and 20 archived views.");
  }
  return { views: payload.views.map(parseArchivedBackupView) };
}

/** Produces a browser-local backup without account identifiers, invite data, or personal responses. */
export function createPilotDashboardArchiveBackup(
  views: ArchivedPilotDashboardViewBackup[],
  exportedAt = Date.now()
) {
  const archivedViews = views
    .filter(view => view.isArchived)
    .map(({ id, name, filters, folder, folderColor, archivedAt, updatedAt }) => ({
      id,
      name,
      filters,
      folder,
      folderColor,
      archivedAt,
      updatedAt,
    }));
  const date = new Date(exportedAt).toISOString().slice(0, 10);
  return {
    fileName: `scheme-sathi-archived-dashboard-views-${date}.json`,
    contents: `${JSON.stringify({
      format: "scheme-sathi-archived-dashboard-views-v1",
      exportedAt,
      scope: "administrator-private archived dashboard views",
      views: archivedViews,
    }, null, 2)}\n`,
  };
}
