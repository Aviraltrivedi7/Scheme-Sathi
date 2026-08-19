import { describe, expect, it } from "vitest";
import { schemeCatalog } from "@shared/schemeCatalog";
import { filterSchemeCatalog } from "./schemeCatalogQuery";

describe("source-aware scheme catalog queries", () => {
  it("filters scholarship records by official verification status", () => {
    const records = filterSchemeCatalog(schemeCatalog, {
      category: "Education",
      verificationStatus: "officialDirectory",
    });

    expect(records.length).toBeGreaterThanOrEqual(30);
    expect(records.every(record => record.category === "Education")).toBe(true);
    expect(records.every(record => record.verificationStatus === "officialDirectory")).toBe(true);
  });

  it("filters by administering body without case sensitivity and sorts by provider area", () => {
    const provider = schemeCatalog.find(
      record => record.category === "Education"
    )?.administeringBody;
    expect(provider).toBeTruthy();
    const providerRecords = filterSchemeCatalog(schemeCatalog, {
      administeringBody: provider!.toLowerCase(),
    });
    const providerSorted = filterSchemeCatalog(schemeCatalog, { sort: "provider" });

    expect(providerRecords.length).toBeGreaterThan(0);
    expect(providerRecords.every(record => record.administeringBody === provider)).toBe(true);
    expect(providerSorted.map(record => record.administeringBody)).toEqual(
      [...providerSorted.map(record => record.administeringBody)].sort((a, b) =>
        a.localeCompare(b)
      )
    );
  });
});
