import { Check, Copy, MessageCircle, Share2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Scheme } from "@/lib/schemes";
import { createSchemeShareText, createSchemeShareUrl, createWhatsAppSchemeShareUrl, maxCustomSchemeShareNoteLength, shareScheme } from "@/lib/schemeSharing";

type Language = "en" | "hi";

export function SchemeSharePreviewCard({ scheme, initialLanguage, onClose }: { scheme: Scheme; initialLanguage: Language; onClose: () => void }) {
  const [shareLanguage, setShareLanguage] = useState<Language>(initialLanguage);
  const [copying, setCopying] = useState(false);
  const [customNote, setCustomNote] = useState("");
  const isHindi = shareLanguage === "hi";
  const name = isHindi ? scheme.nameHindi : scheme.name;
  const benefit = isHindi ? scheme.benefitsHindi : scheme.benefits;
  const shareNatively = async () => {
    try {
      const result = await shareScheme(scheme, shareLanguage, customNote);
      if (result === "copied") toast.success(isHindi ? "शेयर करने के लिए लिंक कॉपी हो गया।" : "Scheme link copied for sharing.");
      if (result !== "dismissed") onClose();
    } catch {
      toast.error(isHindi ? "शेयर विकल्प उपलब्ध नहीं है। WhatsApp या कॉपी लिंक चुनें।" : "Sharing is unavailable. Choose WhatsApp or Copy link.");
    }
  };
  const copyShare = async () => {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(createSchemeShareText(scheme, shareLanguage, undefined, customNote));
      toast.success(isHindi ? "शेयर संदेश कॉपी हो गया।" : "Share message copied.");
    } catch {
      toast.error(isHindi ? "कॉपी नहीं हो सका।" : "Could not copy the share message.");
    } finally {
      setCopying(false);
    }
  };
  return <div className="share-preview-backdrop" role="presentation" onMouseDown={onClose}><section className="share-preview-card" role="dialog" aria-modal="true" aria-labelledby="share-preview-title" onMouseDown={event => event.stopPropagation()}><button type="button" className="share-preview-close" onClick={onClose} aria-label={isHindi ? "शेयर प्रीव्यू बंद करें" : "Close share preview"}><X size={16} /></button><p className="share-preview-kicker"><Share2 size={14} /> {isHindi ? "शेयर करने से पहले देखें" : "PREVIEW BEFORE SHARING"}</p><h2 id="share-preview-title">{name}</h2><p className="share-preview-benefit">{benefit}</p><p className="share-preview-url">{createSchemeShareUrl(scheme.id)}</p><div className="share-language-choice" role="group" aria-label="Share language"><button type="button" className={shareLanguage === "en" ? "active" : ""} onClick={() => setShareLanguage("en")}><Check size={13} /> English</button><button type="button" className={shareLanguage === "hi" ? "active" : ""} onClick={() => setShareLanguage("hi")}><Check size={13} /> हिंदी</button></div><label className="share-preview-note"><span>{isHindi ? "अपना संदेश (वैकल्पिक)" : "Personal note (optional)"}</span><textarea value={customNote} maxLength={maxCustomSchemeShareNoteLength} onChange={event => setCustomNote(event.target.value)} placeholder={isHindi ? "उदाहरण: यह योजना आपके काम की हो सकती है" : "Example: This scheme may be useful for you"} /><small>{customNote.length}/{maxCustomSchemeShareNoteLength}</small></label><div className="share-preview-actions"><button type="button" className="share-preview-native" onClick={shareNatively}><Share2 size={15} /> {isHindi ? "शेयर विकल्प" : "Share options"}</button><a href={createWhatsAppSchemeShareUrl(scheme, shareLanguage, undefined, customNote)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a><button type="button" className="share-preview-copy" disabled={copying} onClick={copyShare}><Copy size={15} /> {isHindi ? "कॉपी करें" : "Copy"}</button></div></section></div>;
}
