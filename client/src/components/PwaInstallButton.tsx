import { Check, Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Language = "en" | "hi";
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}

export function PwaInstallButton({ language }: { language: Language }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const isHindi = language === "hi";

  useEffect(() => {
    setInstalled(isStandalone());
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowIosHelp(false);
      toast.success(isHindi ? "Scheme Sathi ऐप इंस्टॉल हो गया।" : "Scheme Sathi is installed.");
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [isHindi]);

  const requestInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "dismissed") {
        toast.message(isHindi ? "इंस्टॉल रद्द किया गया। आप बाद में फिर कोशिश कर सकते हैं।" : "Install dismissed. You can try again later.");
      }
      return;
    }
    if (isAppleMobile()) {
      setShowIosHelp(current => !current);
      return;
    }
    toast.message(isHindi ? "ब्राउज़र तैयार होने पर इंस्टॉल विकल्प दिखाएगा।" : "Your browser will show the install option when the app is ready.");
  };

  if (installed) {
    return <span className="pwa-install-status" aria-label={isHindi ? "ऐप इंस्टॉल है" : "App installed"}><Check size={14} /><span>{isHindi ? "इंस्टॉल" : "Installed"}</span></span>;
  }

  return <div className="pwa-install-wrap"><button type="button" className="pwa-install-button" onClick={requestInstall} aria-expanded={showIosHelp} aria-label={isHindi ? "Scheme Sathi ऐप इंस्टॉल करें" : "Install Scheme Sathi app"}><Download size={15} /><span>{isHindi ? "ऐप इंस्टॉल करें" : "Install app"}</span></button>{showIosHelp && <div className="pwa-ios-help" role="status"><button type="button" onClick={() => setShowIosHelp(false)} aria-label={isHindi ? "इंस्टॉल निर्देश बंद करें" : "Close install instructions"}><X size={14} /></button><strong>{isHindi ? "iPhone / iPad पर इंस्टॉल करें" : "Install on iPhone or iPad"}</strong><p>{isHindi ? "Safari में Share दबाएँ, फिर Add to Home Screen चुनें।" : "In Safari, tap Share, then choose Add to Home Screen."}</p></div>}</div>;
}
