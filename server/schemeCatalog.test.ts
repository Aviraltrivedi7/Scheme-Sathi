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
});
