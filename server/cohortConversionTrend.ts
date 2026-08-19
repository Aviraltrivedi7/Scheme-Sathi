export type MonthlyCohortEventTotal = {
  month: string;
  total: number;
};
export type CohortTrendPeriod = "month" | "quarter";

function percentage(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function toTotalsByMonth(rows: MonthlyCohortEventTotal[]) {
  return new Map(rows.map(row => [row.month, Number(row.total)]));
}

function periodKey(month: string, period: CohortTrendPeriod) {
  if (period === "month") return month;
  const [year, monthPart] = month.split("-");
  const quarter = Math.floor((Number(monthPart) - 1) / 3) + 1;
  return `${year}-Q${quarter}`;
}

function aggregateByPeriod(rows: MonthlyCohortEventTotal[], period: CohortTrendPeriod) {
  const totals = new Map<string, number>();
  rows.forEach(row => {
    const key = periodKey(row.month, period);
    totals.set(key, (totals.get(key) ?? 0) + Number(row.total));
  });
  return Array.from(totals, ([month, total]) => ({ month, total }));
}

/** Builds privacy-safe all-cohort monthly funnel rates from already aggregated event totals. */
export function buildMonthlyCohortConversionTrend(input: {
  visits: MonthlyCohortEventTotal[];
  feedback: MonthlyCohortEventTotal[];
  signups: MonthlyCohortEventTotal[];
}, period: CohortTrendPeriod = "month") {
  const visits = toTotalsByMonth(aggregateByPeriod(input.visits, period));
  const feedback = toTotalsByMonth(aggregateByPeriod(input.feedback, period));
  const signups = toTotalsByMonth(aggregateByPeriod(input.signups, period));
  const months = Array.from(new Set([
    ...Array.from(visits.keys()),
    ...Array.from(feedback.keys()),
    ...Array.from(signups.keys()),
  ])).sort();

  return months.map(month => {
    const linkVisits = visits.get(month) ?? 0;
    const feedbackSubmissions = feedback.get(month) ?? 0;
    const accountSignups = signups.get(month) ?? 0;
    return {
      month,
      linkVisits,
      feedbackSubmissions,
      accountSignups,
      feedbackRate: percentage(feedbackSubmissions, linkVisits),
      signupRate: percentage(accountSignups, linkVisits),
    };
  });
}
