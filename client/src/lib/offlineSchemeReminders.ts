import type { Scheme } from "@/lib/schemes";

const dayMs = 86_400_000;
export const offlineSchemeReminderStorageKey = "scheme-sathi-offline-deadline-reminders-v1";
export const offlineSchemeReminderLeadDays = [1, 3, 7, 14, 30] as const;
export type OfflineSchemeReminderLeadDays = (typeof offlineSchemeReminderLeadDays)[number];

export type OfflineSchemeReminderSettings = {
  version: 3;
  enabled: boolean;
  leadDays: OfflineSchemeReminderLeadDays[];
  notifiedDeadlineByScheduleKey: Record<string, number>;
};

export type OfflineSchemeReminderCandidate = { scheme: Scheme; leadDays: OfflineSchemeReminderLeadDays };

export const defaultOfflineSchemeReminderSettings = (): OfflineSchemeReminderSettings => ({ version: 3, enabled: false, leadDays: [7], notifiedDeadlineByScheduleKey: {} });

export function isOfflineSchemeReminderLeadDays(value: unknown): value is OfflineSchemeReminderLeadDays {
  return typeof value === "number" && offlineSchemeReminderLeadDays.includes(value as OfflineSchemeReminderLeadDays);
}

export function normalizeOfflineSchemeReminderLeadDays(value: unknown): OfflineSchemeReminderLeadDays[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(isOfflineSchemeReminderLeadDays))).sort((left, right) => left - right);
}

function safeNotificationLedger(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, number> : {};
}

export function readOfflineSchemeReminderSettings(storage: Pick<Storage, "getItem">): OfflineSchemeReminderSettings {
  try {
    const raw = storage.getItem(offlineSchemeReminderStorageKey);
    if (!raw) return defaultOfflineSchemeReminderSettings();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultOfflineSchemeReminderSettings();
    const settings = parsed as { version?: unknown; enabled?: unknown; leadDays?: unknown; notifiedDeadlineBySchemeId?: unknown; notifiedDeadlineByScheduleKey?: unknown };
    if ((settings.version === 1 || settings.version === 2) && typeof settings.enabled === "boolean" && isOfflineSchemeReminderLeadDays(settings.leadDays)) {
      const legacyLedger = safeNotificationLedger(settings.notifiedDeadlineBySchemeId);
      return { version: 3, enabled: settings.enabled, leadDays: [settings.leadDays], notifiedDeadlineByScheduleKey: Object.fromEntries(Object.entries(legacyLedger).map(([schemeId, deadline]) => [`${schemeId}:${settings.leadDays}`, deadline])) };
    }
    const leadDays = normalizeOfflineSchemeReminderLeadDays(settings.leadDays);
    if (settings.version !== 3 || typeof settings.enabled !== "boolean" || !leadDays.length || !settings.notifiedDeadlineByScheduleKey || typeof settings.notifiedDeadlineByScheduleKey !== "object") return defaultOfflineSchemeReminderSettings();
    return { version: 3, enabled: settings.enabled, leadDays, notifiedDeadlineByScheduleKey: safeNotificationLedger(settings.notifiedDeadlineByScheduleKey) };
  } catch {
    return defaultOfflineSchemeReminderSettings();
  }
}

export function writeOfflineSchemeReminderSettings(storage: Pick<Storage, "setItem">, settings: OfflineSchemeReminderSettings) {
  storage.setItem(offlineSchemeReminderStorageKey, JSON.stringify(settings));
}

export function offlineSchemeReminderScheduleKey(schemeId: string, leadDays: OfflineSchemeReminderLeadDays) {
  return `${schemeId}:${leadDays}`;
}

export function getDueOfflineSchemeDeadlineReminderCandidates(schemes: Scheme[], settings: OfflineSchemeReminderSettings, now = Date.now()): OfflineSchemeReminderCandidate[] {
  return schemes.flatMap(scheme => settings.leadDays.map(leadDays => ({ scheme, leadDays }))).filter(({ scheme, leadDays }) => {
    const deadline = scheme.applicationDeadline;
    if (!deadline || deadline <= now || settings.notifiedDeadlineByScheduleKey[offlineSchemeReminderScheduleKey(scheme.id, leadDays)] === deadline) return false;
    return deadline - leadDays * dayMs <= now;
  });
}

export function getDueOfflineSchemeDeadlineReminders(schemes: Scheme[], settings: OfflineSchemeReminderSettings, now = Date.now()) {
  return Array.from(new Map(getDueOfflineSchemeDeadlineReminderCandidates(schemes, settings, now).map(candidate => [candidate.scheme.id, candidate.scheme])).values());
}

export function markOfflineSchemeDeadlineReminderCandidates(settings: OfflineSchemeReminderSettings, candidates: OfflineSchemeReminderCandidate[]): OfflineSchemeReminderSettings {
  const notifiedDeadlineByScheduleKey = { ...settings.notifiedDeadlineByScheduleKey };
  candidates.forEach(({ scheme, leadDays }) => {
    if (scheme.applicationDeadline) notifiedDeadlineByScheduleKey[offlineSchemeReminderScheduleKey(scheme.id, leadDays)] = scheme.applicationDeadline;
  });
  return { ...settings, notifiedDeadlineByScheduleKey };
}

export function markOfflineSchemeDeadlineReminders(settings: OfflineSchemeReminderSettings, schemes: Pick<Scheme, "id" | "applicationDeadline">[]): OfflineSchemeReminderSettings {
  const candidates = schemes.flatMap(scheme => settings.leadDays.map(leadDays => ({ scheme: scheme as Scheme, leadDays })));
  return markOfflineSchemeDeadlineReminderCandidates(settings, candidates);
}
