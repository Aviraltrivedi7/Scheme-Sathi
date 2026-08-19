import { describe, expect, it } from "vitest";
import {
  discoverLabel,
  providerDisplayLabel,
  stateDisplayLabel,
} from "../client/src/lib/discoverLocalization";
import { createCohortConversionReportCsv } from "../client/src/lib/pilotCohortReports";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Hindi discovery localization", () => {
  it("translates scholarship provider labels while preserving canonical filter values", () => {
    expect(providerDisplayLabel("Ministry of Education", "hi")).toBe("शिक्षा मंत्रालय");
    expect(providerDisplayLabel("Ministry of Education", "en")).toBe("Ministry of Education");
    expect(providerDisplayLabel("Unknown provider", "hi")).toBe("Unknown provider");
    expect(stateDisplayLabel("Uttar Pradesh", "hi")).toBe("उत्तर प्रदेश");
    expect(stateDisplayLabel("Maharashtra", "hi")).toBe("महाराष्ट्र");
    expect(discoverLabel("providerArea", "hi")).toBe("संचालक विभाग");
    expect(discoverLabel("sourceStatus", "hi")).toBe("स्रोत स्थिति");
  });
});

describe("cohort conversion report CSV", () => {
  it("exports range-scoped aggregate metrics with spreadsheet-safe cells", () => {
    const report = createCohortConversionReportCsv([
      {
        cohortName: "=Pune, Scholarship Cell",
        cohortType: "college",
        active: true,
        linkVisits: 20,
        feedbackSubmissions: 7,
        feedbackRate: 35,
        accountSignups: 4,
        signupRate: 20,
      },
    ], { startAt: 1_700_000_000_000, endAt: 1_700_086_400_000 }, {
      cohortType: "college",
      months: [{ month: "2026-08", linkVisits: 20, feedbackSubmissions: 7, feedbackRate: 35, accountSignups: 4, signupRate: 20 }],
    });

    expect(report.fileName).toContain("scheme-sathi-cohort-report-2023-11-14-to-2023-11-15.csv");
    expect(report.contents).toContain("\"'=Pune, Scholarship Cell\"");
    expect(report.contents).toContain("\"Visit to signup rate (%)\"");
    expect(report.contents).toContain("\"20\"");
    expect(report.contents).toContain("\"Total (all cohorts)\"");
    expect(report.contents).toContain("\"35\"");
    expect(report.contents).toContain("\"Monthly trend (college cohorts)\"");
    expect(report.contents).toContain("\"Feedback submissions\"");
    expect(report.contents).toContain("\"2026-08\"");
  });
});

describe("monthly cohort trend UI contract", () => {
  it("binds the protected monthly series to a visual line chart", () => {
    const pilotAdmin = readFileSync(resolve(process.cwd(), "client/src/pages/PilotAdmin.tsx"), "utf8");
    expect(pilotAdmin).toContain("trpc.admin.pilot.cohorts.monthlyTrend.useQuery");
    expect(pilotAdmin).toContain("trpc.admin.pilot.cohorts.conversionStats.useQuery(cohortAnalyticsInput");
    expect(pilotAdmin).toContain("<LineChart data={monthlyTrend}");
    expect(pilotAdmin).toContain("All cohorts combined");
    expect(pilotAdmin).toContain('new Intl.DateTimeFormat("hi-IN"');
    expect(pilotAdmin).toContain("trendCohortType");
    expect(pilotAdmin).toContain('option value="college"');
    expect(pilotAdmin).toContain('option value="ngo"');
    expect(pilotAdmin).toContain('setTrendPeriod("quarter")');
    expect(pilotAdmin).toContain("trendPeriodLabel");
  });
});
