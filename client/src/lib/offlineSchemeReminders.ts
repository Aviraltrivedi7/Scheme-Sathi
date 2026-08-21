import type { Scheme } from "@/lib/schemes";

const dayMs = 86_400_000;
export const offlineSchemeReminderStorageKey = "scheme-sathi-offline-deadline-reminders-v1";
export const offlineSchemeReminderLeadDays = [1, 3, 7, 14, 30] as const;
export type OfflineSchemeReminderLeadDays = (typeof offlineSchemeReminderLeadDays)[number];

export type OfflineSchemeReminderSettings = {
  version: 5;
  enabled: boolean;
  leadDays: OfflineSchemeReminderLeadDays[];
  notifiedDeadlineByScheduleKey: Record<string, number>;
  disabledSchemeIds: string[];
  snoozedUntilBySchemeId: Record<string, number>;
};

export type OfflineSchemeReminderCandidate = { scheme: Scheme; leadDays: OfflineSchemeReminderLeadDays };
export const defaultOfflineSchemeReminderSettings = (): OfflineSchemeReminderSettings => ({ version: 5, enabled: false, leadDays: [7], notifiedDeadlineByScheduleKey: {}, disabledSchemeIds: [], snoozedUntilBySchemeId: {} });

export function isOfflineSchemeReminderLeadDays(value: unknown): value is OfflineSchemeReminderLeadDays { return typeof value === "number" && offlineSchemeReminderLeadDays.includes(value as OfflineSchemeReminderLeadDays); }
export function normalizeOfflineSchemeReminderLeadDays(value: unknown): OfflineSchemeReminderLeadDays[] { return Array.isArray(value) ? Array.from(new Set(value.filter(isOfflineSchemeReminderLeadDays))).sort((left, right) => left - right) : []; }
function safeNotificationLedger(value: unknown) { return value && typeof value === "object" ? value as Record<string, number> : {}; }
function safeSnoozes(value: unknown) { return value && typeof value === "object" ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, until]) => typeof until === "number" && Number.isFinite(until))) as Record<string, number> : {}; }

export function readOfflineSchemeReminderSettings(storage: Pick<Storage, "getItem">): OfflineSchemeReminderSettings {
  try {
    const raw = storage.getItem(offlineSchemeReminderStorageKey);
    if (!raw) return defaultOfflineSchemeReminderSettings();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultOfflineSchemeReminderSettings();
    const settings = parsed as { version?: unknown; enabled?: unknown; leadDays?: unknown; notifiedDeadlineBySchemeId?: unknown; notifiedDeadlineByScheduleKey?: unknown; disabledSchemeIds?: unknown; snoozedUntilBySchemeId?: unknown };
    if ((settings.version === 1 || settings.version === 2) && typeof settings.enabled === "boolean" && isOfflineSchemeReminderLeadDays(settings.leadDays)) {
      const legacyLedger = safeNotificationLedger(settings.notifiedDeadlineBySchemeId);
      return { version: 5, enabled: settings.enabled, leadDays: [settings.leadDays], notifiedDeadlineByScheduleKey: Object.fromEntries(Object.entries(legacyLedger).map(([schemeId, deadline]) => [`${schemeId}:${settings.leadDays}`, deadline])), disabledSchemeIds: [], snoozedUntilBySchemeId: {} };
    }
    const leadDays = normalizeOfflineSchemeReminderLeadDays(settings.leadDays);
    if ((settings.version === 3 || settings.version === 4) && typeof settings.enabled === "boolean" && leadDays.length && settings.notifiedDeadlineByScheduleKey && typeof settings.notifiedDeadlineByScheduleKey === "object") return { version: 5, enabled: settings.enabled, leadDays, notifiedDeadlineByScheduleKey: safeNotificationLedger(settings.notifiedDeadlineByScheduleKey), disabledSchemeIds: Array.isArray(settings.disabledSchemeIds) ? settings.disabledSchemeIds.filter((item): item is string => typeof item === "string") : [], snoozedUntilBySchemeId: {} };
    if (settings.version !== 5 || typeof settings.enabled !== "boolean" || !leadDays.length || !settings.notifiedDeadlineByScheduleKey || typeof settings.notifiedDeadlineByScheduleKey !== "object" || !Array.isArray(settings.disabledSchemeIds) || !settings.disabledSchemeIds.every(item => typeof item === "string")) return defaultOfflineSchemeReminderSettings();
    return { version: 5, enabled: settings.enabled, leadDays, notifiedDeadlineByScheduleKey: safeNotificationLedger(settings.notifiedDeadlineByScheduleKey), disabledSchemeIds: settings.disabledSchemeIds, snoozedUntilBySchemeId: safeSnoozes(settings.snoozedUntilBySchemeId) };
  } catch { return defaultOfflineSchemeReminderSettings(); }
}

export function writeOfflineSchemeReminderSettings(storage: Pick<Storage, "setItem">, settings: OfflineSchemeReminderSettings) { storage.setItem(offlineSchemeReminderStorageKey, JSON.stringify(settings)); }
export function offlineSchemeReminderScheduleKey(schemeId: string, leadDays: OfflineSchemeReminderLeadDays) { return `${schemeId}:${leadDays}`; }
export function isOfflineSchemeReminderEnabled(settings: OfflineSchemeReminderSettings, schemeId: string) { return !settings.disabledSchemeIds.includes(schemeId); }
export function isOfflineSchemeReminderSnoozed(settings: OfflineSchemeReminderSettings, schemeId: string, now = Date.now()) { return (settings.snoozedUntilBySchemeId[schemeId] ?? 0) > now; }

export function getDueOfflineSchemeDeadlineReminderCandidates(schemes: Scheme[], settings: OfflineSchemeReminderSettings, now = Date.now()): OfflineSchemeReminderCandidate[] {
  return schemes.flatMap(scheme => settings.leadDays.map(leadDays => ({ scheme, leadDays }))).filter(({ scheme, leadDays }) => {
    const deadline = scheme.applicationDeadline;
    return Boolean(deadline && deadline > now && isOfflineSchemeReminderEnabled(settings, scheme.id) && !isOfflineSchemeReminderSnoozed(settings, scheme.id, now) && settings.notifiedDeadlineByScheduleKey[offlineSchemeReminderScheduleKey(scheme.id, leadDays)] !== deadline && deadline - leadDays * dayMs <= now);
  });
}

export function getDueOfflineSchemeDeadlineReminders(schemes: Scheme[], settings: OfflineSchemeReminderSettings, now = Date.now()) { return Array.from(new Map(getDueOfflineSchemeDeadlineReminderCandidates(schemes, settings, now).map(candidate => [candidate.scheme.id, candidate.scheme])).values()); }
export function markOfflineSchemeDeadlineReminderCandidates(settings: OfflineSchemeReminderSettings, candidates: OfflineSchemeReminderCandidate[]): OfflineSchemeReminderSettings { const notifiedDeadlineByScheduleKey = { ...settings.notifiedDeadlineByScheduleKey }; candidates.forEach(({ scheme, leadDays }) => { if (scheme.applicationDeadline) notifiedDeadlineByScheduleKey[offlineSchemeReminderScheduleKey(scheme.id, leadDays)] = scheme.applicationDeadline; }); return { ...settings, notifiedDeadlineByScheduleKey }; }
export function markOfflineSchemeDeadlineReminders(settings: OfflineSchemeReminderSettings, schemes: Pick<Scheme, "id" | "applicationDeadline">[]): OfflineSchemeReminderSettings { return markOfflineSchemeDeadlineReminderCandidates(settings, schemes.flatMap(scheme => settings.leadDays.map(leadDays => ({ scheme: scheme as Scheme, leadDays })))); }
