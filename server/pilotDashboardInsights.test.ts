import { describe, expect, it } from "vitest";
import { getQuarterOverQuarterChange, summariseFunnelSegment } from "../client/src/lib/pilotDashboardInsights";
import { createPilotDashboardSearch, parsePilotDashboardFilters } from "../client/src/lib/pilotDashboardView";
import { createPilotDashboardSummary } from "../client/src/lib/pilotDashboardSummary";

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
});
