import { ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, FileText, Landmark, Loader2, Share2, ShieldCheck } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { createWhatsAppSchemeShareUrl, shareScheme } from "@/lib/schemeSharing";
import { toast } from "sonner";
import "./SchemeDetail.css";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default function SchemeDetail() {
  const [, params] = useRoute("/scheme/:schemeId");
  const [, setLocation] = useLocation();
  const schemeId = params?.schemeId ?? "";
  const schemeQuery = trpc.schemes.byId.useQuery({ schemeId }, { enabled: Boolean(schemeId), retry: false });
  const scheme = schemeQuery.data?.scheme;

  if (schemeQuery.isLoading) return <main className="scheme-direct-detail"><div className="scheme-detail-state"><Loader2 className="spin" size={22} /> Loading scheme details…</div></main>;
  if (!scheme) return <main className="scheme-direct-detail"><div className="scheme-detail-state"><Landmark size={24} /><h1>Scheme details are unavailable.</h1><p>This link may be outdated. Browse the current catalogue to find the latest guidance.</p><button onClick={() => setLocation("/discover")}>Browse schemes</button></div></main>;
  const deadline = scheme.applicationDeadline ? new Date(scheme.applicationDeadline) : null;
  const deadlineClosed = deadline ? deadline.getTime() <= Date.now() : false;
  const shareCurrentScheme = async () => {
    try {
      const result = await shareScheme(scheme, "en");
      if (result === "shared") toast.success("Share options opened.");
      if (result === "copied") toast.success("Scheme link copied for sharing.");
    } catch {
      toast.error("We could not open sharing. Try WhatsApp instead.");
    }
  };

  return <main className="scheme-direct-detail">
    <header className="scheme-detail-nav"><button onClick={() => setLocation("/dashboard")}><ArrowLeft size={16} /> Back to Application Desk</button><button onClick={() => setLocation("/discover")}>Browse schemes</button></header>
    <section className="scheme-detail-hero">
      <div><span className={`category-tag ${scheme.accent}`}>{scheme.category}</span><h1>{scheme.name}</h1><p>{scheme.benefits}</p><div className="scheme-detail-source"><ShieldCheck size={15} />{scheme.administeringBody} <span>•</span> {scheme.reviewed}</div></div>
      <aside className={`scheme-detail-deadline ${deadlineClosed ? "closed" : ""}`}><CalendarClock size={22} /><div><span>APPLICATION TIMING</span><strong>{deadline ? deadlineClosed ? "Application window closed" : dateFormat.format(deadline) : "No deadline announced"}</strong><p>{deadline ? scheme.deadlineLabel : "Check the official portal for the next application window."}</p></div></aside>
    </section>
    <section className="scheme-detail-grid">
      <article><span className="detail-section-kicker"><CheckCircle2 size={15} /> KEY ELIGIBILITY</span><ul><li>{scheme.eligibility.ageMin !== undefined ? `Age ${scheme.eligibility.ageMin}${scheme.eligibility.ageMax ? `–${scheme.eligibility.ageMax}` : "+"}` : "See official criteria"}</li><li>{scheme.eligibility.incomeMax ? `Annual income up to ₹${scheme.eligibility.incomeMax.toLocaleString("en-IN")}` : "Income criteria on official portal"}</li><li>{scheme.eligibility.states === "all" ? "Available across India" : scheme.eligibility.states?.join(", ")}</li></ul></article>
      <article><span className="detail-section-kicker"><FileText size={15} /> PREPARE THESE DOCUMENTS</span><ul>{scheme.documents.map(document => <li key={document}>{document}</li>)}</ul></article>
      <article className="scheme-detail-steps"><span className="detail-section-kicker"><Landmark size={15} /> HOW TO APPLY</span><ol>{scheme.steps.map(step => <li key={step}>{step}</li>)}</ol></article>
      <aside className="scheme-detail-action"><h2>Verify before you apply.</h2><p>Scheme Sathi is a guide. Confirm current eligibility, documents, dates and application steps on the official portal.</p><a href={scheme.portalUrl} target="_blank" rel="noreferrer">Open official portal <ExternalLink size={15} /></a><button type="button" onClick={shareCurrentScheme}><Share2 size={15} /> Share scheme</button><a className="scheme-detail-whatsapp" href={createWhatsAppSchemeShareUrl(scheme, "en")} target="_blank" rel="noreferrer">WhatsApp</a></aside>
    </section>
  </main>;
}
