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
    expect(pilotAdmin).toContain("getQuarterOverQuarterChange");
    expect(pilotAdmin).toContain("pilot-qoq-badges");
    expect(pilotAdmin).toContain("Segment total");
    expect(pilotAdmin).toContain("copyDashboardView");
    expect(pilotAdmin).toContain("createPilotDashboardSearch");
    expect(pilotAdmin).toContain("TooltipContent");
    expect(pilotAdmin).toContain("percentage points. It is not percentage growth");
    expect(pilotAdmin).toContain("trpc.admin.pilot.views.list.useQuery");
    expect(pilotAdmin).toContain("saveCurrentDashboardView");
    expect(pilotAdmin).toContain("createPilotDashboardSummary");
    expect(pilotAdmin).toContain("Export summary");
    expect(pilotAdmin).toContain("savedViewSearch");
    expect(pilotAdmin).toContain("visibleSavedViews");
    expect(pilotAdmin).toContain("setDashboardViewPinned");
    expect(pilotAdmin).toContain("summaryLanguage");
    expect(pilotAdmin).toContain('option value="hi"');
    expect(pilotAdmin).toContain("reorderPinnedViews");
    expect(pilotAdmin).toContain("handlePinnedViewDragStart");
    expect(pilotAdmin).toContain("handlePinnedViewDrop");
    expect(pilotAdmin).toContain("draggable={!reorderPinnedViews.isPending}");
    expect(pilotAdmin).toContain("folderFilter");
    expect(pilotAdmin).toContain("folderDraft");
    expect(pilotAdmin).toContain("pilot-folder-badge");
    expect(pilotAdmin).toContain("openHindiPilotDashboardSummaryPdf");
    expect(pilotAdmin).toContain("Hindi PDF");
    expect(pilotAdmin).toContain("handleSavedViewShortcut");
    expect(pilotAdmin).toContain("Alt+ArrowDown Alt+ArrowUp Alt+Enter Alt+S");
    expect(pilotAdmin).toContain("loadAdjacentSavedView");
    expect(pilotAdmin).toContain("renameDashboardViewFolder");
    expect(pilotAdmin).toContain("moveDashboardViewsToFolder");
    expect(pilotAdmin).toContain("selectedSavedViewIds");
    expect(pilotAdmin).toContain("Bulk move saved views");
    expect(pilotAdmin).toContain("Hindi PDF print layout");
    expect(pilotAdmin).toContain("pdfHeaderDraft");
    expect(pilotAdmin).toContain("pdfFooterDraft");
    expect(pilotAdmin).toContain("folderCounts");
    expect(pilotAdmin).toContain("pilot-folder-count-badge");
    expect(pilotAdmin).toContain("duplicateDashboardView");
    expect(pilotAdmin).toContain("Alt+D");
    expect(pilotAdmin).toContain("pilot-duplicate-view");
    expect(pilotAdmin).toContain("pdfLogoDraft");
    expect(pilotAdmin).toContain("pdfCustomLogoUrlDraft");
    expect(pilotAdmin).toContain("pdfDateFormatDraft");
    expect(pilotAdmin).toContain("Custom logo URL");
    expect(pilotAdmin).toContain("savedViewScope");
    expect(pilotAdmin).toContain("activeSavedViews");
    expect(pilotAdmin).toContain("archivedSavedViews");
    expect(pilotAdmin).toContain("setDashboardViewArchived");
    expect(pilotAdmin).toContain("setDashboardFolderColor");
    expect(pilotAdmin).toContain("pilot-view-scope-toggle");
    expect(pilotAdmin).toContain("pilot-archive-view");
    expect(pilotAdmin).toContain("folderColorDraft");
    expect(pilotAdmin).toContain("folderColorOptions");
    expect(pilotAdmin).toContain("color-${view.folderColor");
    expect(pilotAdmin).toContain("createHindiPilotDashboardSummaryPrintHtml");
    expect(pilotAdmin).toContain("pdfPreviewOpen");
    expect(pilotAdmin).toContain("Hindi PDF preview");
    expect(pilotAdmin).toContain("srcDoc={hindiPdfPreviewHtml}");
    expect(pilotAdmin).toContain("restoreArchivedDashboardViews");
    expect(pilotAdmin).toContain("restoreArchived");
    expect(pilotAdmin).toContain("pilot-bulk-restore");
    expect(pilotAdmin).toContain("Folder color legend");
    expect(pilotAdmin).toContain("pilot-folder-color-legend");
    expect(pilotAdmin).toContain("pdfPreviewZoom");
    expect(pilotAdmin).toContain("pdfMarginDraft");
    expect(pilotAdmin).toContain("Preview zoom");
    expect(pilotAdmin).toContain("Print margins");
    expect(pilotAdmin).toContain("archiveRetentionLabel");
    expect(pilotAdmin).toContain("pilot-archive-retention");
    expect(pilotAdmin).toContain("deleteDashboardFolder");
    expect(pilotAdmin).toContain("deleteFolder");
    expect(pilotAdmin).toContain("Folder quick actions");
    expect(pilotAdmin).toContain("pilot-folder-quick-trigger");
    expect(pilotAdmin).toContain("pdfPageBreakGuides");
    expect(pilotAdmin).toContain("Show A4 page-break guides");
    expect(pilotAdmin).toContain("showPageBreakGuides: pdfPageBreakGuides");
    expect(pilotAdmin).toContain("archiveSettingsQuery");
    expect(pilotAdmin).toContain("setArchiveRetention");
    expect(pilotAdmin).toContain("Retention period");
    expect(pilotAdmin).toContain("createPilotDashboardArchiveBackup");
    expect(pilotAdmin).toContain("Backup archived views");
    expect(pilotAdmin).toContain("pdfHeaderAlignmentDraft");
    expect(pilotAdmin).toContain("pdfFooterAlignmentDraft");
    expect(pilotAdmin).toContain("Header position");
    expect(pilotAdmin).toContain("Footer position");
  });
});
