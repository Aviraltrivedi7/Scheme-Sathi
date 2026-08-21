import { describe, expect, it } from "vitest";
import { createOfflineSavedSchemesSnapshot, offlineSavedSchemesStorageKey, readOfflineSavedSchemesSnapshot, sortOfflineSavedSchemes, writeOfflineSavedSchemesSnapshot } from "../client/src/lib/offlineSavedSchemes";
import { createSchemeShareText, createSchemeShareUrl, createWhatsAppSchemeShareUrl, getSchemeShareNoteTemplate, maxCustomSchemeShareNoteLength, normalizeCustomSchemeShareNote } from "../client/src/lib/schemeSharing";
import { defaultOfflineSchemeReminderSettings, getDueOfflineSchemeDeadlineReminderCandidates, getDueOfflineSchemeDeadlineReminders, markOfflineSchemeDeadlineReminders, offlineSchemeReminderLeadDays, offlineSchemeReminderStorageKey, readOfflineSchemeReminderSettings, writeOfflineSchemeReminderSettings } from "../client/src/lib/offlineSchemeReminders";
import { buildOfflineSavedDeadlineCalendar, getOfflineDeadlineTiming } from "../client/src/lib/offlineSavedDeadlineCalendar";
import { createCustomSchemeShareTemplateBackup, customSchemeShareTemplatesStorageKey, normalizeCustomSchemeShareTemplate, parseCustomSchemeShareTemplateBackup, readCustomSchemeShareTemplates, writeCustomSchemeShareTemplates } from "../client/src/lib/customSchemeShareTemplates";
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

  it("creates device-only seven-day reminder candidates once per saved deadline", () => {
    const now = Date.UTC(2026, 7, 1, 9);
    const reminderScheme = { ...scheme, applicationDeadline: now + 5 * 86_400_000 };
    const tooEarly = { ...scheme, id: "later", applicationDeadline: now + 8 * 86_400_000 };
    const settings = defaultOfflineSchemeReminderSettings();
    expect(getDueOfflineSchemeDeadlineReminders([reminderScheme, tooEarly], settings, now)).toEqual([reminderScheme]);
    const marked = markOfflineSchemeDeadlineReminders(settings, [reminderScheme]);
    expect(getDueOfflineSchemeDeadlineReminders([reminderScheme], marked, now)).toEqual([]);
    expect(getDueOfflineSchemeDeadlineReminders([{ ...reminderScheme, applicationDeadline: now - 1 }], settings, now)).toEqual([]);
  });

  it("persists only local reminder settings and recovers safely from invalid values", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const enabled = { ...defaultOfflineSchemeReminderSettings(), enabled: true };
    writeOfflineSchemeReminderSettings(storage, enabled);
    expect(values.has(offlineSchemeReminderStorageKey)).toBe(true);
    expect(readOfflineSchemeReminderSettings(storage)).toEqual(enabled);
    values.set(offlineSchemeReminderStorageKey, JSON.stringify({ version: 1, enabled: true, leadDays: 5 }));
    expect(readOfflineSchemeReminderSettings(storage)).toEqual(defaultOfflineSchemeReminderSettings());
  });

  it("migrates legacy seven-day settings and applies a selected lead time exactly", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    values.set(offlineSchemeReminderStorageKey, JSON.stringify({ version: 1, enabled: true, leadDays: 7, notifiedDeadlineBySchemeId: {} }));
    expect(readOfflineSchemeReminderSettings(storage)).toMatchObject({ version: 5, enabled: true, leadDays: [7], disabledSchemeIds: [], snoozedUntilBySchemeId: {} });
    expect(offlineSchemeReminderLeadDays).toEqual([1, 3, 7, 14, 30]);
    const now = Date.UTC(2026, 7, 1);
    const threeDays = { ...scheme, applicationDeadline: now + 3 * 86_400_000 };
    const settings = { ...defaultOfflineSchemeReminderSettings(), leadDays: [3] as const };
    expect(getDueOfflineSchemeDeadlineReminders([threeDays], settings, now)).toEqual([threeDays]);
  });

  it("sorts upcoming deadlines first while retaining stable no-deadline and closed ordering", () => {
    const now = Date.UTC(2026, 7, 1);
    const later = { ...scheme, id: "later", applicationDeadline: now + 5 * 86_400_000 };
    const noDeadline = { ...scheme, id: "none", applicationDeadline: null };
    const earlier = { ...scheme, id: "earlier", applicationDeadline: now + 2 * 86_400_000 };
    const closed = { ...scheme, id: "closed", applicationDeadline: now - 1 };
    expect(sortOfflineSavedSchemes([later, noDeadline, earlier, closed], "deadlineAsc", now).map(item => item.id)).toEqual(["earlier", "later", "none", "closed"]);
    expect(sortOfflineSavedSchemes([later, noDeadline], "saved", now)).toEqual([later, noDeadline]);
  });

  it("bounds custom notes and includes the selected note in public share text only", () => {
    const note = `  Suggested for your family.  `;
    expect(normalizeCustomSchemeShareNote(note)).toBe("Suggested for your family.");
    expect(normalizeCustomSchemeShareNote("x".repeat(maxCustomSchemeShareNoteLength + 12))).toHaveLength(maxCustomSchemeShareNoteLength);
    expect(createSchemeShareText(scheme, "en", "https://scheme.example", note)).toContain("Suggested for your family.\n\nEducation Support");
  });

  it("creates one due candidate per selected schedule and keeps each schedule distinct", () => {
    const now = Date.UTC(2026, 7, 1);
    const deadlineScheme = { ...scheme, applicationDeadline: now + 3 * 86_400_000 };
    const settings = { ...defaultOfflineSchemeReminderSettings(), leadDays: [1, 3, 7] as const };
    const candidates = getDueOfflineSchemeDeadlineReminderCandidates([deadlineScheme], settings, now);
    expect(candidates.map(candidate => candidate.leadDays)).toEqual([3, 7]);
  });

  it("builds a Monday-first calendar grid with upcoming saved deadlines only", () => {
    const now = Date.UTC(2026, 7, 1);
    const upcoming = { ...scheme, id: "upcoming", applicationDeadline: Date.UTC(2026, 7, 5, 12) };
    const closed = { ...scheme, id: "closed", applicationDeadline: now - 1 };
    const calendar = buildOfflineSavedDeadlineCalendar([upcoming, closed], new Date(2026, 7, 1), now);
    expect(calendar).toHaveLength(42);
    expect(calendar[0]?.date.getDay()).toBe(1);
    expect(calendar.find(day => day.date.getDate() === 5 && day.isCurrentMonth)?.schemes.map(item => item.id)).toEqual(["upcoming"]);
  });

  it("provides bounded public audience templates in both supported languages", () => {
    expect(getSchemeShareNoteTemplate("family", "en")).toContain("family");
    expect(getSchemeShareNoteTemplate("college", "hi")).toContain("कॉलेज");
    expect(getSchemeShareNoteTemplate("ngo", "en").length).toBeLessThan(maxCustomSchemeShareNoteLength);
  });

  it("classifies calendar deadline colors consistently", () => {
    const now = Date.UTC(2026, 7, 1);
    expect(getOfflineDeadlineTiming(now + 7 * 86_400_000, now)).toBe("urgent");
    expect(getOfflineDeadlineTiming(now + 8 * 86_400_000, now)).toBe("soon");
    expect(getOfflineDeadlineTiming(now + 31 * 86_400_000, now)).toBe("later");
  });

  it("excludes a reminder-disabled scheme without deleting its schedule preferences", () => {
    const now = Date.UTC(2026, 7, 1);
    const due = { ...scheme, applicationDeadline: now + 3 * 86_400_000 };
    const disabled = { ...defaultOfflineSchemeReminderSettings(), leadDays: [3] as const, disabledSchemeIds: [due.id] };
    expect(getDueOfflineSchemeDeadlineReminderCandidates([due], disabled, now)).toEqual([]);
    expect(disabled.leadDays).toEqual([3]);
    expect(disabled.disabledSchemeIds).toEqual([due.id]);
  });

  it("excludes a snoozed scheme until its local snooze time ends without changing schedules", () => {
    const now = Date.UTC(2026, 7, 1);
    const due = { ...scheme, applicationDeadline: now + 3 * 86_400_000 };
    const settings = { ...defaultOfflineSchemeReminderSettings(), leadDays: [3] as const, snoozedUntilBySchemeId: { [due.id]: now + 86_400_000 } };
    expect(getDueOfflineSchemeDeadlineReminderCandidates([due], settings, now)).toEqual([]);
    expect(getDueOfflineSchemeDeadlineReminderCandidates([due], settings, now + 86_400_000)).toHaveLength(1);
    expect(settings.leadDays).toEqual([3]);
  });

  it("keeps bounded valid custom templates only in browser-local storage", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const template = normalizeCustomSchemeShareTemplate({ name: "Family note", note: "  Please review this benefit. " });
    expect(template).toEqual({ name: "Family note", note: "Please review this benefit." });
    writeCustomSchemeShareTemplates(storage, [{ id: "family-1", ...template! }]);
    expect(readCustomSchemeShareTemplates(storage)).toEqual([{ id: "family-1", ...template! }]);
    expect(values.has(customSchemeShareTemplatesStorageKey)).toBe(true);
    expect(normalizeCustomSchemeShareTemplate({ name: "", note: "message" })).toBeNull();
  });

  it("exports strict local template backups and imports collision-safe names", () => {
    const existing = [{ id: "original", name: "Family note", note: "Existing" }];
    const backup = createCustomSchemeShareTemplateBackup([{ id: "backup", name: "Family note", note: "Imported" }], 1);
    const restored = parseCustomSchemeShareTemplateBackup(JSON.stringify(backup), existing);
    expect(restored).toEqual([...existing, expect.objectContaining({ name: "Family note (2)", note: "Imported" })]);
    expect(() => parseCustomSchemeShareTemplateBackup(JSON.stringify({ ...backup, version: 2 }), existing)).toThrow("Backup version");
  });
});
