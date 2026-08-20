import { describe, expect, it } from "vitest";
import { createPilotDashboardArchiveBackup, createPilotDashboardArchiveRestorePreview, parsePilotDashboardArchiveBackup } from "../client/src/lib/pilotDashboardArchiveBackup";

const archivedView = {
  id: 3,
  name: "College Q2",
  filters: { from: "2026-04-01", to: "2026-06-30", segment: "college" as const, view: "quarter" as const },
  folder: "Leadership review",
  folderColor: "indigo",
  archivedAt: 1_700_000_000_000,
  updatedAt: 1_700_000_100_000,
  isArchived: true,
};

describe("pilot dashboard archived-view backup", () => {
  it("exports only archived private view fields with a verifiable v1 integrity record", async () => {
    const backup = await createPilotDashboardArchiveBackup([
      archivedView,
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
    expect(payload.integrity).toEqual(expect.objectContaining({ algorithm: "SHA-256", digest: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(payload.views).toEqual([expect.objectContaining({ id: 3, name: "College Q2", folderColor: "indigo" })]);
    expect(backup.contents).not.toContain("Active view");
    expect(backup.contents).not.toContain("userId");
    expect(backup.contents).not.toContain("cohortName");

    await expect(parsePilotDashboardArchiveBackup(backup.contents)).resolves.toEqual(expect.objectContaining({
      integrity: expect.objectContaining({ formatVersion: "v1", status: "verified", algorithm: "SHA-256" }),
      views: [expect.objectContaining({ name: "College Q2", folderColor: "indigo" })],
    }));
  });

  it("parses a legacy v1 local archived-view backup into a restore payload with a legacy badge state", async () => {
    const parsed = await parsePilotDashboardArchiveBackup(JSON.stringify({
      format: "scheme-sathi-archived-dashboard-views-v1",
      exportedAt: 1_786_716_800_000,
      scope: "administrator-private archived dashboard views",
      views: [{
        ...archivedView,
        name: " College Q2 ",
        folder: " Review ",
      }],
    }));

    expect(parsed).toEqual({
      exportedAt: 1_786_716_800_000,
      integrity: { formatVersion: "v1", status: "legacy", algorithm: null, digest: null },
      views: [{
        name: "College Q2",
        filters: { from: "2026-04-01", to: "2026-06-30", segment: "college", view: "quarter" },
        folder: "Review",
        folderColor: "indigo",
      }],
    });
  });

  it("rejects tampered, malformed, oversized, or unsupported archived-view backups", async () => {
    await expect(parsePilotDashboardArchiveBackup("not json")).rejects.toThrow("valid Scheme Sathi");
    await expect(parsePilotDashboardArchiveBackup(JSON.stringify({ format: "another-format", views: [] }))).rejects.toThrow("Scheme Sathi archived-view JSON backup");
    await expect(parsePilotDashboardArchiveBackup(JSON.stringify({
      format: "scheme-sathi-archived-dashboard-views-v1",
      exportedAt: 1_786_716_800_000,
      scope: "administrator-private archived dashboard views",
      views: Array.from({ length: 21 }, (_, index) => ({ ...archivedView, id: index + 1 })),
    }))).rejects.toThrow("between 1 and 20");

    const backup = await createPilotDashboardArchiveBackup([archivedView], 1_786_716_800_000);
    const tampered = JSON.parse(backup.contents);
    tampered.views[0].name = "Changed after export";
    await expect(parsePilotDashboardArchiveBackup(JSON.stringify(tampered))).rejects.toThrow("integrity check failed");
  });

  it("rejects unsupported archive folder colors and invalid filter segments", async () => {
    const createBackup = (view: Record<string, unknown>) => JSON.stringify({
      format: "scheme-sathi-archived-dashboard-views-v1",
      exportedAt: 1_786_716_800_000,
      scope: "administrator-private archived dashboard views",
      views: [view],
    });
    const baseView = { ...archivedView, folder: null, folderColor: null };

    await expect(parsePilotDashboardArchiveBackup(createBackup({ ...baseView, folderColor: "rose" }))).rejects.toThrow("unsupported folder color");
    await expect(parsePilotDashboardArchiveBackup(createBackup({ ...baseView, filters: { ...baseView.filters, segment: "district" } }))).rejects.toThrow("invalid dashboard filter configuration");
  });

  it("previews collision-safe restored names and blocks a restore that would exceed the view limit", () => {
    const preview = createPilotDashboardArchiveRestorePreview([
      { name: "College Q2", filters: archivedView.filters, folder: archivedView.folder, folderColor: "indigo" },
      { name: "Fresh review", filters: archivedView.filters, folder: null, folderColor: null },
    ], ["College Q2", "College Q2 (restored)", "Existing 3"]);

    expect(preview).toEqual(expect.objectContaining({
      canRestore: true,
      existingViewCount: 3,
      importedViewCount: 2,
      remainingSlots: 15,
      conflicts: [{ sourceName: "College Q2", restoredName: "College Q2 (restored 2)" }],
    }));
    expect(preview.views.map(view => view.restoredName)).toEqual(["College Q2 (restored 2)", "Fresh review"]);

    expect(createPilotDashboardArchiveRestorePreview([
      { name: "Last slot", filters: archivedView.filters, folder: null, folderColor: null },
      { name: "Over limit", filters: archivedView.filters, folder: null, folderColor: null },
    ], Array.from({ length: 19 }, (_, index) => `Saved ${index + 1}`))).toEqual(expect.objectContaining({
      canRestore: false,
      remainingSlots: 0,
    }));
  });
});
