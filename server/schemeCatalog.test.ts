import { describe, expect, it } from "vitest";
import { schemeCatalog } from "@shared/schemeCatalog";

describe("bilingual document checklists", () => {
  it("keeps one Hindi document label aligned to every English checklist item", () => {
    expect(schemeCatalog.length).toBeGreaterThan(0);
    for (const scheme of schemeCatalog) {
      expect(scheme.documentsHindi).toHaveLength(scheme.documents.length);
      expect(scheme.documentsHindi.every((label) => label.trim().length > 0)).toBe(true);
    }
  });

  it("tracks officially notified schemes separately from the NSP directory", () => {
    const notices = schemeCatalog.filter(scheme => scheme.verificationStatus === "officialNotice");
    expect(notices.length).toBeGreaterThan(0);
    for (const scheme of notices) {
      expect(scheme.portalUrl).toMatch(/^https:\/\/.+\..+/);
      expect(scheme.sourceUrl).toBeTruthy();
      expect(scheme.reviewed).toMatch(/Official portal checked/);
    }
  });
});
