import { ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, FileText, Landmark, Languages, Loader2, Share2, ShieldCheck } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { SchemeSharePreviewCard } from "@/components/SchemeSharePreviewCard";
import { useMemo, useState } from "react";
import "./SchemeDetail.css";

export default function SchemeDetail() {
  const [, params] = useRoute("/scheme/:schemeId");
  const [, setLocation] = useLocation();
  const schemeId = params?.schemeId ?? "";
  const [language, setLanguage] = useState<"en" | "hi">(() => (localStorage.getItem("scheme-language") === "hi" ? "hi" : "en"));
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" }), [language]);
  const text = (en: string, hi: string) => (language === "hi" ? hi : en);
  const schemeQuery = trpc.schemes.byId.useQuery({ schemeId }, { enabled: Boolean(schemeId), retry: false });
  const scheme = schemeQuery.data?.scheme;
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);

  if (schemeQuery.isLoading) return <main className="scheme-direct-detail"><div className="scheme-detail-state"><Loader2 className="spin" size={22} /> {text("Loading scheme details…", "योजना विवरण लोड हो रहा है…")}</div></main>;
  if (schemeQuery.isError) return <main className="scheme-direct-detail"><div className="scheme-detail-state"><Landmark size={24} /><h1>{text("Scheme details could not load.", "योजना विवरण लोड नहीं हो सका।")}</h1><p>{text("Please try again in a moment.", "कृपया कुछ समय बाद फिर कोशिश करें।")}</p><div style={{ display: "flex", gap: 8 }}><button onClick={() => schemeQuery.refetch()}>{text("Retry", "फिर कोशिश करें")}</button><button onClick={() => setLocation("/discover")}>{text("Browse schemes", "योजनाएँ देखें")}</button></div></div></main>;
  if (!scheme) return <main className="scheme-direct-detail"><div className="scheme-detail-state"><Landmark size={24} /><h1>{text("Scheme details are unavailable.", "योजना विवरण उपलब्ध नहीं है।")}</h1><p>{text("This link may be outdated. Browse the current catalogue to find the latest guidance.", "यह लिंक पुराना हो सकता है। नवीनतम जानकारी के लिए वर्तमान सूची देखें।")}</p><button onClick={() => setLocation("/discover")}>{text("Browse schemes", "योजनाएँ देखें")}</button></div></main>;
  const deadline = scheme.applicationDeadline ? new Date(scheme.applicationDeadline) : null;
  const deadlineClosed = deadline ? deadline.getTime() <= Date.now() : false;
  const toggleLanguage = () => setLanguage(current => {
    const next = current === "hi" ? "en" : "hi";
    try { localStorage.setItem("scheme-language", next); } catch { /* ignore */ }
    return next;
  });
  return <main className="scheme-direct-detail">
    <header className="scheme-detail-nav"><button onClick={() => setLocation("/dashboard")}><ArrowLeft size={16} /> {text("Back to Application Desk", "आवेदन डेस्क पर वापस जाएँ")}</button><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={toggleLanguage} aria-pressed={language === "hi"}><Languages size={15} /> {language === "hi" ? "English" : "हिंदी"}</button><button onClick={() => setLocation("/discover")}>{text("Browse schemes", "योजनाएँ देखें")}</button></div></header>
    <section className="scheme-detail-hero">
      <div><span className={`category-tag ${scheme.accent}`}>{text(scheme.category, scheme.categoryHindi ?? scheme.category)}</span><h1>{text(scheme.name, scheme.nameHindi ?? scheme.name)}</h1><p>{text(scheme.benefits, scheme.benefitsHindi ?? scheme.benefits)}</p><div className="scheme-detail-source"><ShieldCheck size={15} />{scheme.administeringBody} <span>•</span> {scheme.reviewed}</div></div>
      <aside className={`scheme-detail-deadline ${deadlineClosed ? "closed" : ""}`}><CalendarClock size={22} /><div><span>{text("APPLICATION TIMING", "आवेदन समय")}</span><strong>{deadline ? deadlineClosed ? text("Application window closed", "आवेदन अवधि बंद हो गई") : dateFormat.format(deadline) : text("No deadline announced", "तारीख घोषित नहीं")}</strong><p>{deadline ? scheme.deadlineLabel : text("Check the official portal for the next application window.", "अगली आवेदन अवधि के लिए आधिकारिक पोर्टल देखें।")}</p></div></aside>
    </section>
    <section className="scheme-detail-grid">
      <article><span className="detail-section-kicker"><CheckCircle2 size={15} /> {text("KEY ELIGIBILITY", "मुख्य पात्रता")}</span><ul><li>{scheme.eligibility.ageMin !== undefined ? `Age ${scheme.eligibility.ageMin}${scheme.eligibility.ageMax ? `–${scheme.eligibility.ageMax}` : "+"}` : text("See official criteria", "आधिकारिक मानदंड देखें")}</li><li>{scheme.eligibility.incomeMax ? `Annual income up to ₹${scheme.eligibility.incomeMax.toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}` : text("Income criteria on official portal", "आय मानदंड आधिकारिक पोर्टल पर")}</li><li>{scheme.eligibility.states === "all" ? text("Available across India", "पूरे भारत में उपलब्ध") : scheme.eligibility.states?.join(", ")}</li></ul></article>
      <article><span className="detail-section-kicker"><FileText size={15} /> {text("PREPARE THESE DOCUMENTS", "ये दस्तावेज़ तैयार रखें")}</span><ul>{(language === "hi" && scheme.documentsHindi?.length ? scheme.documentsHindi : scheme.documents).map(document => <li key={document}>{document}</li>)}</ul></article>
      <article className="scheme-detail-steps"><span className="detail-section-kicker"><Landmark size={15} /> {text("HOW TO APPLY", "आवेदन कैसे करें")}</span><ol>{(language === "hi" && scheme.stepsHindi?.length ? scheme.stepsHindi : scheme.steps).map(step => <li key={step}>{step}</li>)}</ol></article>
      <aside className="scheme-detail-action"><h2>{text("Verify before you apply.", "आवेदन से पहले पुष्टि करें।")}</h2><p>{text("Scheme Sathi is a guide. Confirm current eligibility, documents, dates and application steps on the official portal.", "Scheme Sathi एक मार्गदर्शक है। आधिकारिक पोर्टल पर वर्तमान पात्रता, दस्तावेज़, तारीख और आवेदन चरण ज़रूर जाँचें।")}</p><a href={scheme.portalUrl} target="_blank" rel="noreferrer">{text("Open official portal", "आधिकारिक पोर्टल खोलें")} <ExternalLink size={15} /></a><button type="button" onClick={() => setSharePreviewOpen(true)}><Share2 size={15} /> {text("Share scheme", "योजना साझा करें")}</button><button className="scheme-detail-whatsapp" type="button" onClick={() => setSharePreviewOpen(true)}>WhatsApp</button></aside>
    </section>
    {sharePreviewOpen && <SchemeSharePreviewCard scheme={scheme} initialLanguage={language} onClose={() => setSharePreviewOpen(false)} />}
  </main>;
}
