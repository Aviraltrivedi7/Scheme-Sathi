import { describe, expect, it, vi } from "vitest";
import { getQuarterOverQuarterChange, summariseFunnelSegment } from "../client/src/lib/pilotDashboardInsights";
import { createPilotDashboardSearch, parsePilotDashboardFilters } from "../client/src/lib/pilotDashboardView";
import { createHindiPilotDashboardSummaryPrintHtml, createPilotDashboardSummary, openHindiPilotDashboardSummaryPdf } from "../client/src/lib/pilotDashboardSummary";

describe("pilot dashboard insights", () => {
  it("recomputes segment totals and rates from aggregate event counts", () => {
    expect(summariseFunnelSegment([
      { linkVisits: 20, feedbackSubmissions: 7, accountSignups: 4 },
      { linkVisits: 10, feedbackSubmissions: 6, accountSignups: 2 },
    ])).toEqual({ linkVisits: 30, feedbackSubmissions: 13, accountSignups: 6, feedbackRate: 43.3, signupRate: 20 });
  });

  it("returns percentage-point change for the two most recent quarterly rows only", () => {
    expect(getQuarterOverQuarterChange([
      { month: "2026-Q1", feedbackRate: 30, signupRate: 10 },
      { month: "2026-Q2", feedbackRate: 42.5, signupRate: 18 },
    ])).toEqual({ previousPeriod: "2026-Q1", currentPeriod: "2026-Q2", feedbackPoints: 12.5, signupPoints: 8 });
    expect(getQuarterOverQuarterChange([{ month: "2026-Q1", feedbackRate: 30, signupRate: 10 }])).toBeNull();
  });
});

describe("shareable pilot dashboard filters", () => {
  it("round-trips non-sensitive filters and rejects malformed or inverted dates", () => {
    const filters = { from: "2026-01-01", to: "2026-06-30", segment: "college" as const, view: "quarter" as const };
    expect(createPilotDashboardSearch(filters)).toBe("?from=2026-01-01&to=2026-06-30&segment=college&view=quarter");
    expect(parsePilotDashboardFilters(createPilotDashboardSearch(filters))).toEqual(filters);
    expect(parsePilotDashboardFilters("?from=2026-06-30&to=2026-01-01&segment=unknown&view=year")).toEqual({ from: "", to: "", segment: "all", view: "month" });
  });
});

describe("read-only dashboard summary export", () => {
  it("includes scoped aggregate metrics and omits cohort or personal identifiers", () => {
    const summary = createPilotDashboardSummary({
      filters: { from: "2026-01-01", to: "2026-06-30", segment: "college", view: "quarter" },
      totals: { linkVisits: 30, feedbackSubmissions: 13, accountSignups: 6, feedbackRate: 43.3, signupRate: 20 },
      quarterChange: { previousPeriod: "2026-Q1", currentPeriod: "2026-Q2", feedbackPoints: 12.5, signupPoints: -2 },
    });
    expect(summary.fileName).toBe("scheme-sathi-dashboard-summary-en-2026-01-01-to-2026-06-30.txt");
    expect(summary.contents).toContain("Read-only aggregate view");
    expect(summary.contents).toContain("College cohorts");
    expect(summary.contents).toContain("Feedback change: +12.5 percentage points");
    expect(summary.contents).toContain("Signup change: -2.0 percentage points");
    expect(summary.contents).not.toContain("Pune College Cell");
  });

  it("renders the aggregate-only summary in Hindi when selected", () => {
    const summary = createPilotDashboardSummary({
      language: "hi",
      filters: { from: "", to: "", segment: "ngo", view: "month" },
      totals: { linkVisits: 12, feedbackSubmissions: 6, accountSignups: 2, feedbackRate: 50, signupRate: 16.7 },
      quarterChange: null,
    });
    expect(summary.fileName).toContain("-hi-all-time-to-today.txt");
    expect(summary.contents).toContain("केवल-पढ़ने योग्य समेकित दृश्य");
    expect(summary.contents).toContain("एनजीओ समूह");
    expect(summary.contents).toContain("विज़िटर, खाता, संपर्क");
    expect(summary.contents).not.toContain("Pune College Cell");
  });

  it("opens a Hindi-only aggregate summary in the browser print flow for PDF saving", () => {
    const write = vi.fn();
    const print = vi.fn();
    vi.stubGlobal("window", {
      open: vi.fn(() => ({ document: { open: vi.fn(), write, close: vi.fn() }, print })),
      setTimeout: (callback: () => void) => { callback(); return 1; },
    });
    const opened = openHindiPilotDashboardSummaryPdf({
      filters: { from: "", to: "", segment: "ngo", view: "month" },
      totals: { linkVisits: 12, feedbackSubmissions: 6, accountSignups: 2, feedbackRate: 50, signupRate: 16.7 },
      quarterChange: null,
      header: "कॉलेज पायलट <आंतरिक>",
      footer: "टीम रिपोर्ट & समीक्षा",
      logo: "custom",
      customLogoUrl: "https://assets.example.org/logo.png",
      dateFormat: "iso",
    });
    expect(opened).toBe(true);
    expect(write).toHaveBeenCalledWith(expect.stringContaining("पायलट डैशबोर्ड सारांश"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("केवल-पढ़ने योग्य समेकित दृश्य"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("एनजीओ समूह"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("कॉलेज पायलट &lt;आंतरिक&gt;"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("टीम रिपोर्ट &amp; समीक्षा"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('src="https://assets.example.org/logo.png"'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining(`दिनांक: ${new Date().toISOString().slice(0, 10)}`));
    expect(print).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("builds the same safe aggregate-only HTML for the live Hindi PDF preview", () => {
    const html = createHindiPilotDashboardSummaryPrintHtml({
      filters: { from: "", to: "", segment: "college", view: "month" },
      totals: { linkVisits: 9, feedbackSubmissions: 4, accountSignups: 2, feedbackRate: 44.4, signupRate: 22.2 },
      quarterChange: null,
      header: "पूर्वावलोकन <रिपोर्ट>",
      footer: "निजी & समेकित",
      logo: "custom",
      customLogoUrl: "https://assets.example.org/preview-logo.png",
      dateFormat: "short",
      margin: "compact",
    });
    expect(html).toContain("पायलट डैशबोर्ड सारांश");
    expect(html).toContain("पूर्वावलोकन &lt;रिपोर्ट&gt;");
    expect(html).toContain("निजी &amp; समेकित");
    expect(html).toContain('src="https://assets.example.org/preview-logo.png"');
    expect(html).toContain("@page { size: A4; margin: 12mm; }");
    expect(html).toContain("केवल-पढ़ने योग्य समेकित दृश्य");
    expect(html).not.toContain("Pune College Cell");
  });
});
