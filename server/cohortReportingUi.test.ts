import { describe, expect, it } from "vitest";
import {
  discoverLabel,
  providerDisplayLabel,
} from "../client/src/lib/discoverLocalization";
import { createCohortConversionReportCsv } from "../client/src/lib/pilotCohortReports";

describe("Hindi discovery localization", () => {
  it("translates scholarship provider labels while preserving canonical filter values", () => {
    expect(providerDisplayLabel("Ministry of Education", "hi")).toBe("शिक्षा मंत्रालय");
    expect(providerDisplayLabel("Ministry of Education", "en")).toBe("Ministry of Education");
    expect(providerDisplayLabel("Unknown provider", "hi")).toBe("Unknown provider");
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
    ], { startAt: 1_700_000_000_000, endAt: 1_700_086_400_000 });

    expect(report.fileName).toContain("scheme-sathi-cohort-report-2023-11-14-to-2023-11-15.csv");
    expect(report.contents).toContain("\"'=Pune, Scholarship Cell\"");
    expect(report.contents).toContain("\"Visit to signup rate (%)\"");
    expect(report.contents).toContain("\"20\"");
  });
});
