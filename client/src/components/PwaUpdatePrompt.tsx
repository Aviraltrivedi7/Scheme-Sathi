import { RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

type UpdateReadyDetail = { registration: ServiceWorkerRegistration };

export function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isHindi] = useState(() => {
    try {
      return localStorage.getItem("scheme-language") === "hi";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleReady = (event: Event) => {
      const detail = (event as CustomEvent<UpdateReadyDetail>).detail;
      if (detail?.registration?.waiting) setRegistration(detail.registration);
    };
    const handleControllerChange = () => {
      if (refreshing) window.location.reload();
    };
    window.addEventListener("scheme-sathi-update-ready", handleReady);
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);
    return () => {
      window.removeEventListener("scheme-sathi-update-ready", handleReady);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [refreshing]);

  if (!registration) return null;
  return <aside className="pwa-update-prompt" role="status" aria-live="polite"><div><strong>{isHindi ? "अपडेट उपलब्ध है" : "Update available"}</strong><p>{isHindi ? "Scheme Sathi का नया संस्करण तैयार है। सुविधानुसार रिफ्रेश करके इस्तेमाल करें।" : "A newer Scheme Sathi version is ready. Refresh when convenient to use it."}</p></div><div className="pwa-update-actions"><button type="button" className="pwa-update-later" onClick={() => setRegistration(null)}>{isHindi ? "बाद में" : "Later"}</button><button type="button" className="pwa-update-refresh" disabled={refreshing} onClick={() => { setRefreshing(true); registration.waiting?.postMessage({ type: "SKIP_WAITING" }); }}><RefreshCw className={refreshing ? "spin" : ""} size={14} /> {refreshing ? (isHindi ? "रिफ्रेश हो रहा है…" : "Refreshing…") : (isHindi ? "रिफ्रेश करें" : "Refresh")}</button></div><button type="button" className="pwa-update-close" onClick={() => setRegistration(null)} aria-label={isHindi ? "अपडेट सूचना हटाएँ" : "Dismiss update available"}><X size={14} /></button></aside>;
}
