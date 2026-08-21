import type { Scheme } from "@/lib/schemes";

const dayMs = 86_400_000;
export const offlineSchemeReminderStorageKey = "scheme-sathi-offline-deadline-reminders-v1";
export const offlineSchemeReminderLeadDays = [1, 3, 7, 14, 30] as const;
export type OfflineSchemeReminderLeadDays = (typeof offlineSchemeReminderLeadDays)[number];

export type OfflineSchemeReminderSettings = {
  version: 2;
  enabled: boolean;
  leadDays: OfflineSchemeReminderLeadDays;
  notifiedDeadlineBySchemeId: Record<string, number>;
};

export const defaultOfflineSchemeReminderSettings = (): OfflineSchemeReminderSettings => ({ version: 2, enabled: false, leadDays: 7, notifiedDeadlineBySchemeId: {} });

export function isOfflineSchemeReminderLeadDays(value: unknown): value is OfflineSchemeReminderLeadDays {
  return typeof value === "number" && offlineSchemeReminderLeadDays.includes(value as OfflineSchemeReminderLeadDays);
}

export function readOfflineSchemeReminderSettings(storage: Pick<Storage, "getItem">): OfflineSchemeReminderSettings {
  try {
    const raw = storage.getItem(offlineSchemeReminderStorageKey);
    if (!raw) return defaultOfflineSchemeReminderSettings();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultOfflineSchemeReminderSettings();
    const settings = parsed as { version?: unknown; enabled?: unknown; leadDays?: unknown; notifiedDeadlineBySchemeId?: unknown };
    if (settings.version === 1 && typeof settings.enabled === "boolean" && settings.leadDays === 7 && settings.notifiedDeadlineBySchemeId && typeof settings.notifiedDeadlineBySchemeId === "object") {
      return { version: 2, enabled: settings.enabled, leadDays: 7, notifiedDeadlineBySchemeId: settings.notifiedDeadlineBySchemeId as Record<string, number> };
    }
    if (settings.version !== 2 || typeof settings.enabled !== "boolean" || !isOfflineSchemeReminderLeadDays(settings.leadDays) || !settings.notifiedDeadlineBySchemeId || typeof settings.notifiedDeadlineBySchemeId !== "object") return defaultOfflineSchemeReminderSettings();
    return settings as OfflineSchemeReminderSettings;
  } catch {
    return defaultOfflineSchemeReminderSettings();
  }
}

export function writeOfflineSchemeReminderSettings(storage: Pick<Storage, "setItem">, settings: OfflineSchemeReminderSettings) {
  storage.setItem(offlineSchemeReminderStorageKey, JSON.stringify(settings));
}

export function getDueOfflineSchemeDeadlineReminders(schemes: Scheme[], settings: OfflineSchemeReminderSettings, now = Date.now()) {
  return schemes.filter(scheme => {
    const deadline = scheme.applicationDeadline;
    if (!deadline || deadline <= now || settings.notifiedDeadlineBySchemeId[scheme.id] === deadline) return false;
    const reminderAt = deadline - settings.leadDays * dayMs;
    return reminderAt <= now;
  });
}

export function markOfflineSchemeDeadlineReminders(settings: OfflineSchemeReminderSettings, schemes: Pick<Scheme, "id" | "applicationDeadline">[]): OfflineSchemeReminderSettings {
  const notifiedDeadlineBySchemeId = { ...settings.notifiedDeadlineBySchemeId };
  schemes.forEach(scheme => {
    if (scheme.applicationDeadline) notifiedDeadlineBySchemeId[scheme.id] = scheme.applicationDeadline;
  });
  return { ...settings, notifiedDeadlineBySchemeId };
}
