import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Scheme } from "@/lib/schemes";
import { defaultOfflineSchemeReminderSettings, getDueOfflineSchemeDeadlineReminderCandidates, markOfflineSchemeDeadlineReminderCandidates, offlineSchemeReminderLeadDays, readOfflineSchemeReminderSettings, writeOfflineSchemeReminderSettings, type OfflineSchemeReminderLeadDays, type OfflineSchemeReminderSettings } from "@/lib/offlineSchemeReminders";
import { OfflineSavedDeadlineCalendar } from "@/components/OfflineSavedDeadlineCalendar";

type Language = "en" | "hi";
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

export function OfflineSavedDeadlineReminders({ schemes, language, onOpen }: { schemes: Scheme[]; language: Language; onOpen?: (scheme: Scheme) => void }) {
  const [settings, setSettings] = useState<OfflineSchemeReminderSettings>(() => readOfflineSchemeReminderSettings(localStorage));
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [requesting, setRequesting] = useState(false);
  const isHindi = language === "hi";
  const saveSettings = (next: OfflineSchemeReminderSettings) => {
    writeOfflineSchemeReminderSettings(localStorage, next);
    setSettings(next);
  };

  useEffect(() => {
    if (!settings.enabled || permission !== "granted" || document.visibilityState === "hidden") return;
    const candidates = getDueOfflineSchemeDeadlineReminderCandidates(schemes, settings);
    if (!candidates.length) return;
    candidates.forEach(({ scheme, leadDays }) => {
      const name = isHindi ? scheme.nameHindi : scheme.name;
      const deadline = dateFormat.format(new Date(scheme.applicationDeadline!));
      new Notification(isHindi ? `${name} की समयसीमा` : `${name} deadline`, { body: isHindi ? `आवेदन की अंतिम तिथि ${deadline} है। ${leadDays} दिन पहले की रिमाइंडर।` : `Apply by ${deadline}. ${leadDays}-day reminder.`, tag: `scheme-sathi-deadline-${scheme.id}-${leadDays}` });
    });
    saveSettings(markOfflineSchemeDeadlineReminderCandidates(settings, candidates));
  }, [schemes, settings, permission, isHindi]);

  const toggleLeadDays = (leadDays: OfflineSchemeReminderLeadDays) => {
    const selected = settings.leadDays.includes(leadDays);
    if (selected && settings.leadDays.length === 1) return;
    saveSettings({ ...settings, leadDays: selected ? settings.leadDays.filter(item => item !== leadDays) : [...settings.leadDays, leadDays].sort((left, right) => left - right) });
  };
  const enableReminders = async () => {
    if (typeof Notification === "undefined") return;
    setRequesting(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        toast.message(isHindi ? "सूचनाओं की अनुमति नहीं मिली। आप इसे ब्राउज़र सेटिंग्स से बाद में बदल सकते हैं।" : "Notification permission was not granted. You can change it later in browser settings.");
        return;
      }
      saveSettings({ ...settings, enabled: true });
      toast.success(isHindi ? "चुनी हुई डिवाइस रिमाइंडर चालू हैं।" : "Selected device-only reminders are on.");
    } finally { setRequesting(false); }
  };
  if (!schemes.some(scheme => scheme.applicationDeadline && scheme.applicationDeadline > Date.now())) return null;
  const scheduleSelector = <div className="offline-reminder-schedules" role="group" aria-label={isHindi ? "रिमाइंडर समय" : "Reminder schedules"}><span>{isHindi ? "हर सहेजी योजना के लिए" : "For every saved scheme"}</span><div>{offlineSchemeReminderLeadDays.map(leadDays => <button type="button" key={leadDays} className={settings.leadDays.includes(leadDays) ? "active" : ""} aria-pressed={settings.leadDays.includes(leadDays)} onClick={() => toggleLeadDays(leadDays)}>{settings.leadDays.includes(leadDays) && <Check size={11} />}{isHindi ? `${leadDays} दिन` : `${leadDays} days`}</button>)}</div></div>;
  const calendar = <OfflineSavedDeadlineCalendar schemes={schemes} language={language} onOpen={onOpen} />;
  if (permission === "unsupported") return <>{calendar}<div className="offline-reminder-card unsupported"><BellOff size={17} /><span>{isHindi ? "इस ब्राउज़र में डिवाइस रिमाइंडर उपलब्ध नहीं हैं।" : "This browser does not support device notifications."}</span></div></>;
  if (settings.enabled && permission === "granted") return <>{calendar}<div className="offline-reminder-card enabled"><Bell size={17} /><div><strong>{isHindi ? "एक से अधिक रिमाइंडर समय चालू हैं" : "Multiple reminder schedules are on"}</strong><small>{isHindi ? "हर चुने समय के लिए हर योजना को अलग रिमाइंडर मिल सकती है। ऐप खुला या सक्रिय होने पर ही जाँच होती है।" : "Each saved scheme can notify at every selected lead time. Checks run only while this app is open or active."}</small>{scheduleSelector}</div><button type="button" onClick={() => saveSettings({ ...settings, enabled: false })}>{isHindi ? "बंद करें" : "Turn off"}</button></div></>;
  return <>{calendar}<div className="offline-reminder-card"><Bell size={17} /><div><strong>{isHindi ? "समयसीमा रिमाइंडर चालू करें" : "Turn on deadline reminders"}</strong><small>{isHindi ? "एक योजना के लिए कई समय चुनें। केवल इस डिवाइस पर, ऐप खुला/सक्रिय होने पर।" : "Choose multiple times for each saved scheme. Only on this device while the app is open or active."}</small>{scheduleSelector}</div><button type="button" onClick={enableReminders} disabled={requesting}>{requesting ? <Loader2 className="spin" size={14} /> : <Check size={14} />} {isHindi ? "अनुमति दें" : "Enable"}</button></div></>;
}
