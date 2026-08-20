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
