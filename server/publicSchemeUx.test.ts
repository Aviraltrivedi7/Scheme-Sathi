import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDeadlineUrgency, getScoreBreakdown, schemes, type UserProfile } from "../client/src/lib/schemes";

const farmerProfile: UserProfile = { age: 34, state: "Maharashtra", caste: "OBC", annualIncome: 180000, occupation: "Farmer", gender: "Male", isStudent: false, isFarmer: true, isDisabled: false };

describe("public scheme score and engagement UX", () => {
  it("explains matching and non-matching points from the same profile rules", () => {
    const pmKisan = schemes.find((scheme) => scheme.id === "pmkisan")!;
    const breakdown = getScoreBreakdown(farmerProfile, pmKisan);
    expect(breakdown.find((item) => item.key === "work")).toMatchObject({ points: 22, matched: true });
    expect(breakdown.find((item) => item.key === "farmer")).toMatchObject({ points: 5, matched: true });
    expect(breakdown).toHaveLength(9);
  });

  it("classifies deadline urgency with inclusive closing-soon and closed boundaries", () => {
    const now = Date.UTC(2026, 7, 14, 12);
    expect(getDeadlineUrgency(now + 30 * 86_400_000, now)).toMatchObject({ state: "closingSoon", days: 30 });
    expect(getDeadlineUrgency(now - 1, now)).toMatchObject({ state: "closed" });
    expect(getDeadlineUrgency(null, now)).toMatchObject({ state: "none", days: null });
  });

  it("wires WhatsApp sharing, bounded comparison, and mobile hero order into the public UI", () => {
    const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    const comparison = readFileSync(resolve(process.cwd(), "client/src/components/SchemeComparisonModal.tsx"), "utf8");
    const dashboardNotes = readFileSync(resolve(process.cwd(), "client/src/components/SavedSchemeNotesPanel.tsx"), "utf8");
    const directDetail = readFileSync(resolve(process.cwd(), "client/src/pages/SchemeDetail.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    expect(home).toContain("https://wa.me/?text=");
    expect(home).toContain("current.length >= 3");
    expect(home).toContain("ScoreExplanationModal");
    expect(home).toContain("SchemeComparisonModal");
    expect(home).toContain("createDeadlineCalendarIcs");
    expect(home).toContain("trpc.saved.getNote");
    expect(home).toContain("saved-scheme-note");
    expect(home).toContain("Google Calendar demo");
    expect(home).toContain("calendarDemoSynced");
    expect(comparison).toContain("createComparisonCsv");
    expect(comparison).toContain("openComparisonPdfDialog");
    expect(comparison).toContain("selectedExportFields");
    expect(comparison).toContain("comparisonExports.savePreset");
    expect(comparison).toContain("comparisonExports.listPresets");
    expect(dashboardNotes).toContain("setLocation(`/scheme/${encodeURIComponent(note.schemeId)}`)");
    expect(dashboardNotes).toContain("trpc.saved.upsertNote");
    expect(dashboardNotes).toContain("trpc.saved.deleteNote");
    expect(directDetail).toContain("trpc.schemes.byId");
    expect(css).toMatch(/\.hero-art-wrap\s*\{[\s\S]*?order:\s*-1/);
  });
});
