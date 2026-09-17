import { describe, expect, it } from "vitest";
import { createComparisonCsv, createComparisonPrintHtml, createDeadlineCalendarIcs, escapeComparisonCsvCell, escapeIcsText } from "../client/src/lib/schemeExports";
import { schemes } from "../client/src/lib/schemes";

const nsp = schemes.find((scheme) => scheme.id === "nsp")!;
const pmKisan = schemes.find((scheme) => scheme.id === "pmkisan")!;
const now = Date.UTC(2026, 7, 14, 12, 0, 0);

describe("scheme calendar and comparison exports", () => {
  it("creates an escaped UTC iCalendar deadline event only for an open deadline", () => {
    const calendar = createDeadlineCalendarIcs(nsp, "en", now)!;

    expect(calendar.fileName).toBe("scheme-sathi-nsp-deadline.ics");
    expect(calendar.contents).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0");
    expect(calendar.contents).toContain("DTSTART:20261031T175959Z");
    expect(calendar.contents).toContain("DTEND:20261031T182959Z");
    expect(calendar.contents).toContain("URL:https://scholarships.gov.in/");
    expect(calendar.contents.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(createDeadlineCalendarIcs(nsp, "en", nsp.applicationDeadline!)).toBeNull();
    expect(escapeIcsText("a,b;c\\d\nline")).toBe("a\\,b\\;c\\\\d\\nline");
  });

  it("creates formula-safe quoted CSV and an escaped print-ready comparison report", () => {
    const comparison = [
      { ...nsp, score: 91, factors: ["student"] },
      { ...pmKisan, benefits: '=SUM("not executed")', score: 76, factors: ["farmer"] },
    ];
    const csv = createComparisonCsv(comparison, "en");
    const printable = createComparisonPrintHtml(comparison, "en", new Date(now));

    expect(escapeComparisonCsvCell('=SUM("A1")')).toBe("\"'=SUM(\"\"A1\"\")\"");
    expect(csv).toContain("\"'=SUM(\"\"not executed\"\")\"");
    expect(csv.split("\r\n")).toHaveLength(8);
    expect(printable).toContain("Scheme comparison");
    expect(printable).toContain("Scheme Sathi. Verify current details");
    expect(printable).not.toContain('<script>');
  });

  it("exports only the user-selected comparison fields in both CSV and PDF report content", () => {
    const comparison = [
      { ...nsp, score: 91, factors: ["student"] },
      { ...pmKisan, score: 76, factors: ["farmer"] },
    ];
    const fields = ["benefit", "officialPortal"] as const;
    const csv = createComparisonCsv(comparison, "en", fields);
    const printable = createComparisonPrintHtml(comparison, "en", new Date(now), fields);

    expect(csv).toContain('"Benefit"');
    expect(csv).toContain('"Official portal"');
    expect(csv).not.toContain('"Match score"');
    expect(printable).toContain("Benefit");
    expect(printable).toContain("Official portal");
    expect(printable).not.toContain("Match score");
  });
});
