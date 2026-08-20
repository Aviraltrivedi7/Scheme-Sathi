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
export type PilotDashboardSummaryInput = {
  filters: PilotDashboardFilters;
  totals: PilotDashboardSummaryTotals;
  quarterChange: PilotDashboardQuarterChange;
  language?: PilotDashboardSummaryLanguage;
};

export function createPilotDashboardSummary(input: PilotDashboardSummaryInput) {
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Opens the browser print dialog so the administrator can save the Hindi aggregate-only summary as a PDF. */
export type HindiPilotDashboardPrintBranding = {
  header?: string;
  footer?: string;
};

export function openHindiPilotDashboardSummaryPdf(
  input: Omit<PilotDashboardSummaryInput, "language"> & HindiPilotDashboardPrintBranding
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  const summary = createPilotDashboardSummary({ ...input, language: "hi" });
  const heading = "Scheme Sathi — पायलट डैशबोर्ड सारांश";
  const header = input.header?.trim() || "सरकारी योजना पायलट · समेकित रिपोर्ट";
  const footer = input.footer?.trim() || "केवल आंतरिक उपयोग के लिए · व्यक्तिगत डेटा शामिल नहीं है";
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html lang="hi-IN"><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title><style>@page { size: A4; margin: 18mm; } body { color: #18233d; font: 13px "Noto Sans Devanagari", "Nirmala UI", Mangal, Arial, sans-serif; line-height: 1.7; } .print-header { align-items: flex-start; border-bottom: 2px solid #d88728; display: flex; gap: 16px; justify-content: space-between; margin-bottom: 18px; padding-bottom: 12px; } .print-brand { color: #9b5e15; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; } .print-header-copy { color: #596171; font-size: 11px; max-width: 58%; text-align: right; } h1 { font: 700 23px Georgia, "Noto Serif Devanagari", serif; margin: 0 0 8px; } p { color: #596171; margin: 0 0 20px; } pre { white-space: pre-wrap; overflow-wrap: anywhere; border-top: 1px solid #ded6c8; padding-top: 16px; margin: 0; font: inherit; } footer { align-items: flex-start; border-top: 1px solid #ded6c8; color: #687080; display: flex; font-size: 10px; gap: 16px; justify-content: space-between; margin-top: 20px; padding-top: 9px; } footer span:first-child { max-width: 72%; } @media print { .print-header, footer { break-inside: avoid; } }</style></head><body><header class="print-header"><div class="print-brand">Scheme Sathi</div><div class="print-header-copy">${escapeHtml(header)}</div></header><h1>${escapeHtml(heading)}</h1><p>केवल-पढ़ने योग्य समेकित दृश्य · Scheme Sathi</p><pre>${escapeHtml(summary.contents)}</pre><footer><span>${escapeHtml(footer)}</span><span>Scheme Sathi · ${escapeHtml(new Date().toLocaleString("hi-IN"))}</span></footer></body></html>`);
  printWindow.document.close();
  window.setTimeout(() => printWindow.print(), 240);
  return true;
}
