import { Check, Copy, MessageCircle, Share2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Scheme } from "@/lib/schemes";
import { createSchemeShareText, createSchemeShareUrl, createWhatsAppSchemeShareUrl, getSchemeShareNoteTemplate, maxCustomSchemeShareNoteLength, schemeShareNoteAudiences, shareScheme } from "@/lib/schemeSharing";
import { createCustomSchemeShareTemplateBackup, parseCustomSchemeShareTemplateBackup, readCustomSchemeShareTemplates, writeCustomSchemeShareTemplates, type CustomSchemeShareTemplate } from "@/lib/customSchemeShareTemplates";

type Language = "en" | "hi";

export function SchemeSharePreviewCard({ scheme, initialLanguage, onClose }: { scheme: Scheme; initialLanguage: Language; onClose: () => void }) {
  const [shareLanguage, setShareLanguage] = useState<Language>(initialLanguage);
  const [copying, setCopying] = useState(false);
  const [customNote, setCustomNote] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<CustomSchemeShareTemplate[]>(() => readCustomSchemeShareTemplates(localStorage));
  const [templateName, setTemplateName] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
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
  const saveCustomTemplate = () => {
    const name = templateName.trim().slice(0, 40);
    const note = customNote.trim().slice(0, maxCustomSchemeShareNoteLength);
    if (!name || !note) { toast.error(isHindi ? "टेम्पलेट नाम और संदेश भरें।" : "Add a template name and note first."); return; }
    const next = editingTemplateId ? savedTemplates.map(template => template.id === editingTemplateId ? { ...template, name, note } : template) : [...savedTemplates, { id: crypto.randomUUID(), name, note }].slice(0, 12);
    writeCustomSchemeShareTemplates(localStorage, next);
    setSavedTemplates(next); setTemplateName(""); setEditingTemplateId(null);
  };
  const deleteCustomTemplate = (id: string) => { const next = savedTemplates.filter(template => template.id !== id); writeCustomSchemeShareTemplates(localStorage, next); setSavedTemplates(next); if (editingTemplateId === id) { setEditingTemplateId(null); setTemplateName(""); } };
  const exportTemplates = () => { const blob = new Blob([JSON.stringify(createCustomSchemeShareTemplateBackup(savedTemplates), null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "scheme-sathi-share-templates.json"; anchor.click(); URL.revokeObjectURL(url); };
  const importTemplates = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (file.size > 50_000) { toast.error(isHindi ? "बैकअप फ़ाइल बहुत बड़ी है।" : "Backup file is too large."); return; } try { const next = parseCustomSchemeShareTemplateBackup(await file.text(), savedTemplates); writeCustomSchemeShareTemplates(localStorage, next); setSavedTemplates(next); toast.success(isHindi ? "टेम्पलेट बैकअप इंपोर्ट हो गया।" : "Template backup imported."); } catch { toast.error(isHindi ? "टेम्पलेट बैकअप मान्य नहीं है।" : "Template backup is invalid."); } };
  return <div className="share-preview-backdrop" role="presentation" onMouseDown={onClose}><section className="share-preview-card" role="dialog" aria-modal="true" aria-labelledby="share-preview-title" onMouseDown={event => event.stopPropagation()}><button type="button" className="share-preview-close" onClick={onClose} aria-label={isHindi ? "शेयर प्रीव्यू बंद करें" : "Close share preview"}><X size={16} /></button><p className="share-preview-kicker"><Share2 size={14} /> {isHindi ? "शेयर करने से पहले देखें" : "PREVIEW BEFORE SHARING"}</p><h2 id="share-preview-title">{name}</h2><p className="share-preview-benefit">{benefit}</p><p className="share-preview-url">{createSchemeShareUrl(scheme.id)}</p><div className="share-language-choice" role="group" aria-label="Share language"><button type="button" className={shareLanguage === "en" ? "active" : ""} onClick={() => setShareLanguage("en")}><Check size={13} /> English</button><button type="button" className={shareLanguage === "hi" ? "active" : ""} onClick={() => setShareLanguage("hi")}><Check size={13} /> हिंदी</button></div><div className="share-note-templates" role="group" aria-label={isHindi ? "संदेश टेम्पलेट" : "Note templates"}><span>{isHindi ? "जल्दी भरें" : "QUICK TEMPLATES"}</span><div>{schemeShareNoteAudiences.map(audience => <button type="button" key={audience} onClick={() => setCustomNote(getSchemeShareNoteTemplate(audience, shareLanguage))}>{isHindi ? ({ family: "परिवार", college: "कॉलेज", ngo: "NGO" }[audience]) : audience[0].toUpperCase() + audience.slice(1)}</button>)}</div></div><label className="share-preview-note"><span>{isHindi ? "अपना संदेश (वैकल्पिक)" : "Personal note (optional)"}</span><textarea value={customNote} maxLength={maxCustomSchemeShareNoteLength} onChange={event => setCustomNote(event.target.value)} placeholder={isHindi ? "उदाहरण: यह योजना आपके काम की हो सकती है" : "Example: This scheme may be useful for you"} /><small>{customNote.length}/{maxCustomSchemeShareNoteLength}</small></label><section className="custom-share-templates"><strong>{isHindi ? "अपने टेम्पलेट" : "YOUR TEMPLATES"}</strong><div className="custom-template-editor"><input value={templateName} maxLength={40} onChange={event => setTemplateName(event.target.value)} placeholder={isHindi ? "टेम्पलेट नाम" : "Template name"} /><button type="button" onClick={saveCustomTemplate}>{editingTemplateId ? (isHindi ? "अपडेट" : "Update") : (isHindi ? "सहेजें" : "Save")}</button></div><div className="custom-template-backup"><button type="button" onClick={exportTemplates}>{isHindi ? "बैकअप एक्सपोर्ट" : "Export backup"}</button><button type="button" onClick={() => backupInputRef.current?.click()}>{isHindi ? "बैकअप इंपोर्ट" : "Import backup"}</button><input ref={backupInputRef} type="file" accept="application/json,.json" className="custom-template-backup-input" onChange={importTemplates} /></div>{savedTemplates.map(template => <div className="custom-template-row" key={template.id}><button type="button" onClick={() => setCustomNote(template.note)}>{template.name}</button><button type="button" onClick={() => { setEditingTemplateId(template.id); setTemplateName(template.name); setCustomNote(template.note); }}>{isHindi ? "एडिट" : "Edit"}</button><button type="button" onClick={() => deleteCustomTemplate(template.id)}>{isHindi ? "हटाएँ" : "Delete"}</button></div>)}</section><div className="share-preview-actions"><button type="button" className="share-preview-native" onClick={shareNatively}><Share2 size={15} /> {isHindi ? "शेयर विकल्प" : "Share options"}</button><a href={createWhatsAppSchemeShareUrl(scheme, shareLanguage, undefined, customNote)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a><button type="button" className="share-preview-copy" disabled={copying} onClick={copyShare}><Copy size={15} /> {isHindi ? "कॉपी करें" : "Copy"}</button></div></section></div>;
}
