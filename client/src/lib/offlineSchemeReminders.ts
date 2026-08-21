import type { Scheme } from "@/lib/schemes";

const dayMs = 86_400_000;
export const offlineSchemeReminderStorageKey = "scheme-sathi-offline-deadline-reminders-v1";

export type OfflineSchemeReminderSettings = {
  version: 1;
  enabled: boolean;
  leadDays: 7;
  notifiedDeadlineBySchemeId: Record<string, number>;
};

export const defaultOfflineSchemeReminderSettings = (): OfflineSchemeReminderSettings => ({ version: 1, enabled: false, leadDays: 7, notifiedDeadlineBySchemeId: {} });

export function readOfflineSchemeReminderSettings(storage: Pick<Storage, "getItem">): OfflineSchemeReminderSettings {
  try {
    const raw = storage.getItem(offlineSchemeReminderStorageKey);
    if (!raw) return defaultOfflineSchemeReminderSettings();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultOfflineSchemeReminderSettings();
    const settings = parsed as Partial<OfflineSchemeReminderSettings>;
    if (settings.version !== 1 || typeof settings.enabled !== "boolean" || settings.leadDays !== 7 || !settings.notifiedDeadlineBySchemeId || typeof settings.notifiedDeadlineBySchemeId !== "object") return defaultOfflineSchemeReminderSettings();
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
