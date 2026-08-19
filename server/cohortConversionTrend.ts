export type MonthlyCohortEventTotal = {
  month: string;
  total: number;
};

function percentage(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function toTotalsByMonth(rows: MonthlyCohortEventTotal[]) {
  return new Map(rows.map(row => [row.month, Number(row.total)]));
}

/** Builds privacy-safe all-cohort monthly funnel rates from already aggregated event totals. */
export function buildMonthlyCohortConversionTrend(input: {
  visits: MonthlyCohortEventTotal[];
  feedback: MonthlyCohortEventTotal[];
  signups: MonthlyCohortEventTotal[];
}) {
  const visits = toTotalsByMonth(input.visits);
  const feedback = toTotalsByMonth(input.feedback);
  const signups = toTotalsByMonth(input.signups);
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
