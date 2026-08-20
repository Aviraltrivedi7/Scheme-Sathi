import { describe, expect, it } from "vitest";
import { createOfflineSavedSchemesSnapshot, offlineSavedSchemesStorageKey, readOfflineSavedSchemesSnapshot, writeOfflineSavedSchemesSnapshot } from "../client/src/lib/offlineSavedSchemes";
import { createSchemeShareText, createSchemeShareUrl, createWhatsAppSchemeShareUrl } from "../client/src/lib/schemeSharing";
import type { Scheme } from "../client/src/lib/schemes";

const scheme: Scheme = {
  id: "education-support",
  name: "Education Support",
  nameHindi: "शिक्षा सहायता",
  category: "Education",
  categoryHindi: "शिक्षा",
  level: "Central",
  administeringBody: "Ministry of Education",
  benefits: "A focused education support benefit for eligible households.",
  benefitsHindi: "पात्र परिवारों के लिए शिक्षा सहायता लाभ।",
  eligibility: { states: "all" },
  documents: ["Identity proof"],
  documentsHindi: ["पहचान प्रमाण"],
  steps: ["Verify eligibility"],
  stepsHindi: ["पात्रता जाँचें"],
  portalUrl: "https://example.gov.in",
  reviewed: "Reviewed",
  accent: "saffron",
  artwork: "/manus-storage/example.png",
};

describe("offline saved schemes and sharing", () => {
  it("snapshots only saved public schemes without account or profile fields", () => {
    const snapshot = createOfflineSavedSchemesSnapshot([scheme, { ...scheme, id: "other", name: "Other" }], [scheme.id], 1_786_716_800_000);
    expect(snapshot).toEqual({ version: 1, savedAt: 1_786_716_800_000, schemes: [scheme] });
    expect(JSON.stringify(snapshot)).not.toContain("userId");
    expect(JSON.stringify(snapshot)).not.toContain("profile");
    expect(JSON.stringify(snapshot)).not.toContain("note");
  });

  it("reads valid local snapshots and rejects malformed storage values", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const snapshot = createOfflineSavedSchemesSnapshot([scheme], [scheme.id], 1);
    writeOfflineSavedSchemesSnapshot(storage, snapshot);
    expect(values.has(offlineSavedSchemesStorageKey)).toBe(true);
    expect(readOfflineSavedSchemesSnapshot(storage)).toEqual(snapshot);
    values.set(offlineSavedSchemesStorageKey, "{");
    expect(readOfflineSavedSchemesSnapshot(storage)).toBeNull();
  });

  it("builds Scheme Sathi URLs and a WhatsApp-safe bilingual share message", () => {
    expect(createSchemeShareUrl(scheme.id, "https://scheme.example")).toBe("https://scheme.example/scheme/education-support");
    expect(createSchemeShareText(scheme, "hi", "https://scheme.example")).toContain("शिक्षा सहायता");
    expect(createSchemeShareText(scheme, "hi", "https://scheme.example")).toContain("https://scheme.example/scheme/education-support");
    expect(createWhatsAppSchemeShareUrl(scheme, "en", "https://scheme.example")).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
});
