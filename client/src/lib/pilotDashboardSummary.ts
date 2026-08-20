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

export type PilotDashboardSummaryLanguage = "en" | "hi";

function formatRange(filters: PilotDashboardFilters, language: PilotDashboardSummaryLanguage) {
  if (!filters.from && !filters.to) return language === "hi" ? "सभी समय" : "All time";
  return language === "hi"
    ? `${filters.from || "आरंभ"} से ${filters.to || "आज"}`
    : `${filters.from || "Start"} to ${filters.to || "Today"}`;
}

function pointLabel(value: number, language: PilotDashboardSummaryLanguage) {
  const number = `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
  return language === "hi" ? `${number} प्रतिशत अंक` : `${number} percentage points`;
}

/** Builds a read-only, aggregate-only text summary; it never includes cohort names or personal data. */
export function createPilotDashboardSummary(input: {
  filters: PilotDashboardFilters;
  totals: PilotDashboardSummaryTotals;
  quarterChange: PilotDashboardQuarterChange;
  language?: PilotDashboardSummaryLanguage;
}) {
  const language = input.language ?? "en";
  const hindi = language === "hi";
  const segment = input.filters.segment === "all" ? (hindi ? "सभी समूह" : "All cohorts") : input.filters.segment === "college" ? (hindi ? "कॉलेज समूह" : "College cohorts") : (hindi ? "एनजीओ समूह" : "NGO cohorts");
  const view = input.filters.view === "quarter" ? (hindi ? "त्रैमासिक" : "Quarterly") : (hindi ? "मासिक" : "Monthly");
  const lines = [
    hindi ? "Scheme Sathi — पायलट डैशबोर्ड सारांश" : "Scheme Sathi — Pilot dashboard summary",
    hindi ? "केवल-पढ़ने योग्य समेकित दृश्य" : "Read-only aggregate view",
    "",
    `${hindi ? "तारीख़ सीमा" : "Date range"}: ${formatRange(input.filters, language)}`,
    `${hindi ? "समूह खंड" : "Cohort segment"}: ${segment}`,
    `${hindi ? "ट्रेंड दृश्य" : "Trend view"}: ${view}`,
    "",
    hindi ? "फ़नल कुल" : "Funnel totals",
    `${hindi ? "लिंक विज़िट" : "Link visits"}: ${input.totals.linkVisits}`,
    `${hindi ? "फ़ीडबैक सबमिशन" : "Feedback submissions"}: ${input.totals.feedbackSubmissions} (${input.totals.feedbackRate}%)`,
    `${hindi ? "खाता साइन-अप" : "Account signups"}: ${input.totals.accountSignups} (${input.totals.signupRate}%)`,
  ];
  if (input.quarterChange) {
    lines.push(
      "",
      `${hindi ? "तिमाही तुलना" : "Quarter-over-quarter"}: ${input.quarterChange.previousPeriod} ${hindi ? "से" : "to"} ${input.quarterChange.currentPeriod}`,
      `${hindi ? "फ़ीडबैक बदलाव" : "Feedback change"}: ${pointLabel(input.quarterChange.feedbackPoints, language)}`,
      `${hindi ? "साइन-अप बदलाव" : "Signup change"}: ${pointLabel(input.quarterChange.signupPoints, language)}`
    );
  }
  lines.push("", hindi ? "इस सारांश में केवल समेकित आँकड़े हैं; विज़िटर, खाता, संपर्क या फ़ीडबैक का कोई व्यक्तिगत विवरण शामिल नहीं है।" : "This summary contains aggregate metrics only; no visitor, account, contact, or feedback details are included.");
  return {
    contents: `${lines.join("\n")}\n`,
    fileName: `scheme-sathi-dashboard-summary-${language}-${input.filters.from || "all-time"}-to-${input.filters.to || "today"}.txt`,
  };
}
