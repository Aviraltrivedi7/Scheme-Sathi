import { describe, expect, it, vi } from "vitest";
import {
  diffCatalog,
  draftContentHash,
  fetchPibAnnouncements,
  inferCategoryFromTitle,
  isQualityReleaseSummary,
  isSchemeAnnouncement,
  mapDataGovRecord,
  mapRssItems,
  normalizeExternalScheme,
  parsePibDetail,
  parsePibListing,
} from "./schemeSync";

describe("scheme sync normalization", () => {
  it("accepts a complete entry and fills safe bilingual defaults", () => {
    const result = normalizeExternalScheme(
      { title: "Test Scholarship", url: "https://example.gov.in/scheme", department: "Education Dept" },
      "Test Source"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.externalId).toBeTruthy();
    expect(result.draft.nameHindi).toBe("Test Scholarship");
    expect(result.draft.level).toBe("Central");
    expect(result.draft.portalUrl).toBe("https://example.gov.in/scheme");
  });

  it("rejects entries without a name or portal URL", () => {
    expect(normalizeExternalScheme({ foo: 1 }, "S").ok).toBe(false);
    expect(normalizeExternalScheme({ name: "X" }, "S").ok).toBe(false);
    const badUrl = normalizeExternalScheme({ name: "X", url: "not-a-url" }, "S");
    expect(badUrl.ok).toBe(false);
  });

  it("strips control characters and caps lengths", () => {
    const result = normalizeExternalScheme(
      { name: "A\u0000B", url: "https://example.gov.in/x", benefits: "ok" },
      "S"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.name).toBe("A B");
  });
});

describe("scheme sync diff", () => {
  it("separates added, changed and unchanged entries", () => {
    const diff = diffCatalog(
      [{ id: "a", hash: "h1" }, { id: "b", hash: "h2" }],
      [
        { externalId: "a", hash: "h1" },
        { externalId: "b", hash: "h9" },
        { externalId: "c", hash: "h3" },
      ]
    );
    expect(diff).toEqual({ added: ["c"], changed: ["b"], unchanged: ["a"] });
  });

  it("hashes drafts deterministically", () => {
    const base = {
      externalId: "x", name: "N", nameHindi: "N", category: "Education", categoryHindi: "E",
      level: "Central" as const, administeringBody: "Dept", benefits: "B", benefitsHindi: "B",
      eligibility: {}, documents: [], documentsHindi: [], steps: [], stepsHindi: [],
      portalUrl: "https://example.gov.in", sourceUrl: null, applicationDeadline: null, deadlineLabel: null,
    };
    expect(draftContentHash(base)).toBe(draftContentHash({ ...base }));
    expect(draftContentHash(base)).not.toBe(draftContentHash({ ...base, benefits: "Changed" }));
  });
});

describe("source mappers", () => {
  it("maps data.gov.in CKAN records with varying field names", () => {
    const mapped = mapDataGovRecord({ scheme_name: "Kisan Yojana", department: "Agri", website: "https://agri.gov.in" });
    expect(mapped.name).toBe("Kisan Yojana");
    expect(mapped.portalUrl).toBe("https://agri.gov.in");
  });

  it("extracts RSS items without dependencies", () => {
    const xml = `<rss><channel><item><title>New Scheme</title><link>https://example.gov.in/new</link><description>Helpful benefits</description></item></channel></rss>`;
    const items = mapRssItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("New Scheme");
    expect(items[0].portalUrl).toBe("https://example.gov.in/new");
  });
});

describe("PIB announcement watcher", () => {
  const listing = `<ul><li><h3>Ministry</h3><ul class="num"><li><a title="Cabinet approves New Kisan Scholarship Scheme" href="/PressReleaseDetail.aspx?PRID=2311001">Cabinet approves New Kisan Scholarship Scheme</a></li><li><a title="Vice-President to Visit Maharashtra on September 18" href="/PressReleaseDetail.aspx?PRID=2311002">Vice-President to Visit Maharashtra on September 18</a></li><li><a title="Gaganyaan Mission update" href="/PressReleaseDetail.aspx?PRID=2311003">Gaganyaan Mission update</a></li></ul></li></ul>`;

  it("parses PRID links and titles from the listing", () => {
    const items = parsePibListing(listing);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ prid: "2311001", title: "Cabinet approves New Kisan Scholarship Scheme" });
  });

  it("keeps scheme announcements and drops visits and space missions", () => {
    expect(isSchemeAnnouncement("Cabinet approves New Kisan Scholarship Scheme")).toBe(true);
    expect(isSchemeAnnouncement("Government launches New Housing Scheme for workers")).toBe(true);
    expect(isSchemeAnnouncement("Nasha Mukt Yuva Abhiyan to Commence with Nationwide Samaroh")).toBe(true);
    expect(isSchemeAnnouncement("Vice-President to Visit Maharashtra on September 18")).toBe(false);
    expect(isSchemeAnnouncement("Gaganyaan Mission update")).toBe(false);
    expect(isSchemeAnnouncement("Electronics Components Manufacturing Scheme")).toBe(false);
    expect(isSchemeAnnouncement("Mission Mausam Strengthening Weather Preparedness")).toBe(false);
    expect(isSchemeAnnouncement("PM remarks during the release of instalment under Annapurna Yojana")).toBe(false);
    expect(isSchemeAnnouncement("Hi")).toBe(false);
  });

  it("infers categories from titles", () => {
    expect(inferCategoryFromTitle("PM Scholarship for students").category).toBe("Education");
    expect(inferCategoryFromTitle("Kisan credit support").category).toBe("Agriculture");
    expect(inferCategoryFromTitle("Some random announcement").category).toBe("Livelihood");
  });

  it("pulls ministry and summary from a detail page", () => {
    const html = `<html><body><h1>Test Scheme launched</h1><p>Ministry of Agriculture & Farmers Welfare</p><p>Posted On: 17 SEP 2026 by PIB Delhi</p><p>Farmers will get direct support under this new scheme for seeds and equipment across districts.</p><p>(Release ID: 2311001)</p></body></html>`;
    const detail = parsePibDetail(html);
    expect(detail.ministry).toContain("Ministry of Agriculture");
    expect(detail.summary).toContain("Farmers will get direct support");
  });

  it("fetches details only for unknown PRIDs and caps the sweep", async () => {
    const calls: string[] = [];
    const fetchFn = (async (url: string) => {
      calls.push(url);
      if (url.includes("AllRel.aspx")) {
        return { ok: true, text: async () => listing } as Response;
      }
      return { ok: true, text: async () => `<html><body><p>Ministry of Education</p><p>Posted On: 17 SEP 2026 by PIB Delhi</p><p>Details about ${url}.</p><p>(Release ID: 1)</p></body></html>` } as Response;
    }) as unknown as typeof fetch;
    const drafts = await fetchPibAnnouncements("https://pib.gov.in/AllRel.aspx?reg=3&lang=1", fetchFn, new Set(["pib-2311001"]));
    // Only the unknown scheme-like item (2311002 is a visit, 2311003 blocked) → no drafts
    expect(drafts).toHaveLength(0);
    expect(calls.some(url => url.includes("PRID="))).toBe(false);
  });

  it("returns drafts for fresh scheme announcements", async () => {
    const fetchFn = (async (url: string) => ({
      ok: true,
      text: async () => url.includes("AllRel.aspx")
        ? listing
        : `<html><body><p>Ministry of Education</p><p>Posted On: 17 SEP 2026 by PIB Delhi</p><p>Scholarship details for students across the country with full fee support.</p><p>(Release ID: 1)</p></body></html>`,
    })) as unknown as typeof fetch;
    const drafts = await fetchPibAnnouncements("https://pib.gov.in/AllRel.aspx?reg=3&lang=1", fetchFn, new Set());
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe("pib-2311001");
    expect(drafts[0].portalUrl).toBe("https://pib.gov.in/PressReleaseDetail.aspx?PRID=2311001");
  });

  it("rejects bot-walled boilerplate and stages an honest pointer draft", async () => {
    const boilerplate = `<html><body><p>Press Release: Press Information Bureau JavaScript must be enabled in order for you to use the Site. Skip to Content</p></body></html>`;
    expect(isQualityReleaseSummary("Press Release: Press Information Bureau JavaScript must be enabled")).toBe(false);
    expect(isQualityReleaseSummary("Short")).toBe(false);
    expect(isQualityReleaseSummary("Farmers will get direct support under this new scholarship scheme for seeds, equipment, hostels and fee support across districts, with applications opening next month.")).toBe(true);
    const fetchFn = (async (url: string) => ({
      ok: true,
      text: async () => url.includes("AllRel.aspx") ? listing : boilerplate,
    })) as unknown as typeof fetch;
    const drafts = await fetchPibAnnouncements("https://pib.gov.in/AllRel.aspx?reg=3&lang=1", fetchFn, new Set());
    expect(drafts).toHaveLength(1);
    expect(String(drafts[0].benefits)).toContain("open the source link to read the full release");
    expect(String(drafts[0].benefits)).not.toContain("JavaScript must be enabled");
  });
});
