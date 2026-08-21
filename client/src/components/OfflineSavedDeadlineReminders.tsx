import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Scheme } from "@/lib/schemes";
import { defaultOfflineSchemeReminderSettings, getDueOfflineSchemeDeadlineReminders, markOfflineSchemeDeadlineReminders, readOfflineSchemeReminderSettings, writeOfflineSchemeReminderSettings, type OfflineSchemeReminderSettings } from "@/lib/offlineSchemeReminders";

type Language = "en" | "hi";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

export function OfflineSavedDeadlineReminders({ schemes, language }: { schemes: Scheme[]; language: Language }) {
  const [settings, setSettings] = useState<OfflineSchemeReminderSettings>(() => readOfflineSchemeReminderSettings(localStorage));
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [requesting, setRequesting] = useState(false);
  const isHindi = language === "hi";

  useEffect(() => {
    if (!settings.enabled || permission !== "granted" || document.visibilityState === "hidden") return;
    const dueSchemes = getDueOfflineSchemeDeadlineReminders(schemes, settings);
    if (!dueSchemes.length) return;
    dueSchemes.forEach(scheme => {
      const name = isHindi ? scheme.nameHindi : scheme.name;
      const deadline = dateFormat.format(new Date(scheme.applicationDeadline!));
      new Notification(isHindi ? `${name} की समयसीमा` : `${name} deadline`, { body: isHindi ? `आवेदन की अंतिम तिथि ${deadline} है।` : `Apply by ${deadline}.`, tag: `scheme-sathi-deadline-${scheme.id}` });
    });
    const next = markOfflineSchemeDeadlineReminders(settings, dueSchemes);
    writeOfflineSchemeReminderSettings(localStorage, next);
    setSettings(next);
  }, [schemes, settings, permission, isHindi]);

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
      const next = { ...settings, enabled: true };
      writeOfflineSchemeReminderSettings(localStorage, next);
      setSettings(next);
      toast.success(isHindi ? "7 दिन पहले की डिवाइस रिमाइंडर चालू हैं।" : "Device-only 7-day deadline reminders are on.");
    } finally {
      setRequesting(false);
    }
  };
  const disableReminders = () => {
    const next = { ...settings, enabled: false };
    writeOfflineSchemeReminderSettings(localStorage, next);
    setSettings(next);
  };
  if (!schemes.some(scheme => scheme.applicationDeadline && scheme.applicationDeadline > Date.now())) return null;
  if (permission === "unsupported") return <div className="offline-reminder-card unsupported"><BellOff size={17} /><span>{isHindi ? "इस ब्राउज़र में डिवाइस रिमाइंडर उपलब्ध नहीं हैं।" : "This browser does not support device notifications."}</span></div>;
  if (settings.enabled && permission === "granted") return <div className="offline-reminder-card enabled"><Bell size={17} /><div><strong>{isHindi ? "7 दिन पहले की रिमाइंडर चालू हैं" : "7-day deadline reminders are on"}</strong><small>{isHindi ? "ऐप खुला या सक्रिय होने पर ही इस डिवाइस पर जाँच होती है।" : "They are checked only while this app is open or active on this device."}</small></div><button type="button" onClick={disableReminders}>{isHindi ? "बंद करें" : "Turn off"}</button></div>;
  return <div className="offline-reminder-card"><Bell size={17} /><div><strong>{isHindi ? "समयसीमा रिमाइंडर चालू करें" : "Turn on deadline reminders"}</strong><small>{isHindi ? "सहेजी योजनाओं के लिए अंतिम तिथि से 7 दिन पहले। केवल इस डिवाइस पर, ऐप खुला/सक्रिय होने पर।" : "For saved schemes, 7 days before deadline. Only on this device while the app is open or active."}</small></div><button type="button" onClick={enableReminders} disabled={requesting}>{requesting ? <Loader2 className="spin" size={14} /> : <Check size={14} />} {isHindi ? "अनुमति दें" : "Enable"}</button></div>;
}
