import { describe, expect, it } from "vitest";
import { buildMonthlyCohortConversionTrend } from "./cohortConversionTrend";

describe("monthly cohort conversion trend", () => {
  it("merges aggregate event months and calculates rates from visit counts", () => {
    expect(buildMonthlyCohortConversionTrend({
      visits: [{ month: "2026-06", total: 20 }, { month: "2026-07", total: 10 }],
      feedback: [{ month: "2026-06", total: 7 }, { month: "2026-07", total: 2 }],
      signups: [{ month: "2026-06", total: 4 }, { month: "2026-07", total: 3 }],
    })).toEqual([
      { month: "2026-06", linkVisits: 20, feedbackSubmissions: 7, accountSignups: 4, feedbackRate: 35, signupRate: 20 },
      { month: "2026-07", linkVisits: 10, feedbackSubmissions: 2, accountSignups: 3, feedbackRate: 20, signupRate: 30 },
    ]);
  });

  it("returns a safe zero-rate month when only later funnel activity exists", () => {
    expect(buildMonthlyCohortConversionTrend({
      visits: [],
      feedback: [{ month: "2026-08", total: 1 }],
      signups: [{ month: "2026-08", total: 1 }],
    })).toEqual([
      { month: "2026-08", linkVisits: 0, feedbackSubmissions: 1, accountSignups: 1, feedbackRate: 0, signupRate: 0 },
    ]);
  });
});
