import { describe, expect, it } from "vitest";
import { createPilotDashboardArchiveBackup } from "../client/src/lib/pilotDashboardArchiveBackup";

describe("pilot dashboard archived-view backup", () => {
  it("exports only archived private view fields without account or cohort identifiers", () => {
    const backup = createPilotDashboardArchiveBackup([
      {
        id: 3,
        name: "College Q2",
        filters: { from: "2026-04-01", to: "2026-06-30", segment: "college", view: "quarter" },
        folder: "Leadership review",
        folderColor: "indigo",
        archivedAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
        isArchived: true,
      },
      {
        id: 4,
        name: "Active view",
        filters: { from: "", to: "", segment: "all", view: "month" },
        folder: null,
        folderColor: null,
        archivedAt: null,
        updatedAt: 1_700_000_200_000,
        isArchived: false,
      },
    ], 1_786_716_800_000);

    expect(backup.fileName).toBe("scheme-sathi-archived-dashboard-views-2026-08-14.json");
    const payload = JSON.parse(backup.contents);
    expect(payload.scope).toBe("administrator-private archived dashboard views");
    expect(payload.views).toEqual([expect.objectContaining({ id: 3, name: "College Q2", folderColor: "indigo" })]);
    expect(backup.contents).not.toContain("Active view");
    expect(backup.contents).not.toContain("userId");
    expect(backup.contents).not.toContain("cohortName");
  });
});
