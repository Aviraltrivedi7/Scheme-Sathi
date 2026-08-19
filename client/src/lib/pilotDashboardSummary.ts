import type { PilotDashboardFilters } from "./pilotDashboardView";

export type PilotDashboardSummaryTotals = {
  linkVisits: number;
  feedbackSubmissions: number;
  accountSignups: number;
  feedbackRate: number;
  signupRate: number;
};

export type PilotDashboardQuarterChange = {
  previousPeriod: string;
  currentPeriod: string;
  feedbackPoints: number;
  signupPoints: number;
} | null;

function formatRange(filters: PilotDashboardFilters) {
  if (!filters.from && !filters.to) return "All time";
  return `${filters.from || "Start"} to ${filters.to || "Today"}`;
}

function pointLabel(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} percentage points`;
}

/** Builds a read-only, aggregate-only text summary; it never includes cohort names or personal data. */
export function createPilotDashboardSummary(input: {
  filters: PilotDashboardFilters;
  totals: PilotDashboardSummaryTotals;
  quarterChange: PilotDashboardQuarterChange;
}) {
  const segment = input.filters.segment === "all" ? "All cohorts" : input.filters.segment === "college" ? "College cohorts" : "NGO cohorts";
  const view = input.filters.view === "quarter" ? "Quarterly" : "Monthly";
  const lines = [
    "Scheme Sathi — Pilot dashboard summary",
    "Read-only aggregate view",
    "",
    `Date range: ${formatRange(input.filters)}`,
    `Cohort segment: ${segment}`,
    `Trend view: ${view}`,
    "",
    "Funnel totals",
    `Link visits: ${input.totals.linkVisits}`,
    `Feedback submissions: ${input.totals.feedbackSubmissions} (${input.totals.feedbackRate}%)`,
    `Account signups: ${input.totals.accountSignups} (${input.totals.signupRate}%)`,
  ];
  if (input.quarterChange) {
    lines.push(
      "",
      `Quarter-over-quarter: ${input.quarterChange.previousPeriod} to ${input.quarterChange.currentPeriod}`,
      `Feedback change: ${pointLabel(input.quarterChange.feedbackPoints)}`,
      `Signup change: ${pointLabel(input.quarterChange.signupPoints)}`
    );
  }
  lines.push("", "This summary contains aggregate metrics only; no visitor, account, contact, or feedback details are included.");
  return {
    contents: `${lines.join("\n")}\n`,
    fileName: `scheme-sathi-dashboard-summary-${input.filters.from || "all-time"}-to-${input.filters.to || "today"}.txt`,
  };
}
