export type FunnelCohortRow = {
  linkVisits: number;
  feedbackSubmissions: number;
  accountSignups: number;
};

export type TrendRateRow = {
  month: string;
  feedbackRate: number;
  signupRate: number;
};

function percentage(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function pointDelta(current: number, previous: number) {
  return Math.round((current - previous) * 10) / 10;
}

export function summariseFunnelSegment(rows: FunnelCohortRow[]) {
  const counts = rows.reduce(
    (summary, row) => ({
      linkVisits: summary.linkVisits + row.linkVisits,
      feedbackSubmissions: summary.feedbackSubmissions + row.feedbackSubmissions,
      accountSignups: summary.accountSignups + row.accountSignups,
    }),
    { linkVisits: 0, feedbackSubmissions: 0, accountSignups: 0 }
  );
  return {
    ...counts,
    feedbackRate: percentage(counts.feedbackSubmissions, counts.linkVisits),
    signupRate: percentage(counts.accountSignups, counts.linkVisits),
  };
}

/** Compares the two most recent returned quarterly rows as percentage-point changes. */
export function getQuarterOverQuarterChange(rows: TrendRateRow[]) {
  if (rows.length < 2) return null;
  const previous = rows[rows.length - 2];
  const current = rows[rows.length - 1];
  return {
    previousPeriod: previous.month,
    currentPeriod: current.month,
    feedbackPoints: pointDelta(current.feedbackRate, previous.feedbackRate),
    signupPoints: pointDelta(current.signupRate, previous.signupRate),
  };
}
