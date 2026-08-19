export type CohortConversionReportRow = {
  cohortName: string;
  cohortType: "college" | "ngo";
  active: boolean;
  linkVisits: number;
  feedbackSubmissions: number;
  accountSignups: number;
  feedbackRate: number;
  signupRate: number;
};

export type CohortReportRange = { startAt?: number; endAt?: number };
export type CohortMonthlyTrendRow = {
  month: string;
  linkVisits: number;
  feedbackSubmissions: number;
  accountSignups: number;
  feedbackRate: number;
  signupRate: number;
};
export type CohortMonthlyTrendExport = {
  cohortType: "all" | "college" | "ngo";
  months: CohortMonthlyTrendRow[];
};

function escapeCsvCell(value: string | number) {
  const normalized = String(value).replace(/\r\n|\r|\n/g, " ");
  const formulaSafe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

function rangeLabel(range: CohortReportRange) {
  const format = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const start = range.startAt ? format.format(new Date(range.startAt)) : "All time";
  const end = range.endAt ? format.format(new Date(range.endAt)) : "Today";
  return `${start} to ${end}`;
}

function fileDate(value: number | undefined, fallback: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : fallback;
}

function percentage(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

export function createCohortConversionReportCsv(rows: CohortConversionReportRow[], range: CohortReportRange, monthlyTrend?: CohortMonthlyTrendExport) {
  const heading = ["Scheme Sathi cohort conversion report", rangeLabel(range)];
  const header = ["Cohort", "Type", "Status", "Link visits", "Feedback submissions", "Feedback rate (%)", "Account signups", "Visit to signup rate (%)"];
  const content = rows.map(row => [
    row.cohortName,
    row.cohortType,
    row.active ? "Active" : "Closed",
    row.linkVisits,
    row.feedbackSubmissions,
    row.feedbackRate,
    row.accountSignups,
    row.signupRate,
  ]);
  const totals = rows.reduce(
    (summary, row) => ({
      linkVisits: summary.linkVisits + row.linkVisits,
      feedbackSubmissions: summary.feedbackSubmissions + row.feedbackSubmissions,
      accountSignups: summary.accountSignups + row.accountSignups,
    }),
    { linkVisits: 0, feedbackSubmissions: 0, accountSignups: 0 }
  );
  const summaryRow = [
    "Total (all cohorts)",
    "",
    "",
    totals.linkVisits,
    totals.feedbackSubmissions,
    percentage(totals.feedbackSubmissions, totals.linkVisits),
    totals.accountSignups,
    percentage(totals.accountSignups, totals.linkVisits),
  ];
  const trendScope = monthlyTrend?.cohortType === "college" ? "college cohorts" : monthlyTrend?.cohortType === "ngo" ? "NGO cohorts" : "all cohorts";
  const monthlyTrendSection = monthlyTrend
    ? [
        [],
        [`Monthly trend (${trendScope})`],
        ["Month", "Link visits", "Feedback submissions", "Feedback rate (%)", "Account signups", "Visit to signup rate (%)"],
        ...monthlyTrend.months.map(month => [
          month.month,
          month.linkVisits,
          month.feedbackSubmissions,
          month.feedbackRate,
          month.accountSignups,
          month.signupRate,
        ]),
        ...(monthlyTrend.months.length ? [] : [["No monthly cohort conversion data in this date range"]]),
      ]
    : [];
  return {
    contents: [heading, header, ...content, summaryRow, ...monthlyTrendSection].map(row => row.map(escapeCsvCell).join(",")).join("\r\n").concat("\r\n"),
    fileName: `scheme-sathi-cohort-report-${fileDate(range.startAt, "all-time")}-to-${fileDate(range.endAt, "today")}.csv`,
  };
}
