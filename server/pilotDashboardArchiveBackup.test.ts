import { describe, expect, it } from "vitest";
import { createPilotDashboardArchiveBackup, parsePilotDashboardArchiveBackup } from "../client/src/lib/pilotDashboardArchiveBackup";

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

  it("parses a valid local archived-view backup into a strict restore payload", () => {
    const parsed = parsePilotDashboardArchiveBackup(JSON.stringify({
      format: "scheme-sathi-archived-dashboard-views-v1",
      views: [{
        name: " College Q2 ",
        filters: { from: "2026-04-01", to: "2026-06-30", segment: "college", view: "quarter" },
        folder: " Review ",
        folderColor: "indigo",
        id: 44,
        archivedAt: 1_700_000_000_000,
      }],
    }));

    expect(parsed).toEqual({
      views: [{
        name: "College Q2",
        filters: { from: "2026-04-01", to: "2026-06-30", segment: "college", view: "quarter" },
        folder: "Review",
        folderColor: "indigo",
      }],
    });
  });

  it("rejects malformed, oversized, or unsupported archived-view backups", () => {
    expect(() => parsePilotDashboardArchiveBackup("not json")).toThrow("valid Scheme Sathi");
    expect(() => parsePilotDashboardArchiveBackup(JSON.stringify({ format: "another-format", views: [] }))).toThrow("Scheme Sathi archived-view JSON backup");
    expect(() => parsePilotDashboardArchiveBackup(JSON.stringify({
      format: "scheme-sathi-archived-dashboard-views-v1",
      views: Array.from({ length: 21 }, () => ({ name: "View", filters: { from: "", to: "", segment: "all", view: "month" }, folder: null, folderColor: null })),
    }))).toThrow("between 1 and 20");
  });

  it("rejects unsupported archive folder colors and invalid filter segments", () => {
    const createBackup = (view: Record<string, unknown>) => JSON.stringify({
      format: "scheme-sathi-archived-dashboard-views-v1",
      views: [view],
    });
    const baseView = { name: "View", filters: { from: "", to: "", segment: "all", view: "month" }, folder: null, folderColor: null };

    expect(() => parsePilotDashboardArchiveBackup(createBackup({ ...baseView, folderColor: "rose" }))).toThrow("unsupported folder color");
    expect(() => parsePilotDashboardArchiveBackup(createBackup({ ...baseView, filters: { ...baseView.filters, segment: "district" } }))).toThrow("invalid dashboard filter configuration");
  });
});
