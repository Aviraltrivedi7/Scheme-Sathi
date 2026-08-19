import { categories, states } from "@/lib/schemes";
import { discoverLabel, providerDisplayLabel, type DiscoverLanguage } from "@/lib/discoverLocalization";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CalendarClock, Filter, Languages, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Discover() {
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState<DiscoverLanguage>("hi");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState<"all" | "Central" | "State">("all");
  const [deadline, setDeadline] = useState<"all" | "announced" | "closingSoon" | "openEnded">("all");
  const [administeringBody, setAdministeringBody] = useState("all");
  const [verificationStatus, setVerificationStatus] = useState<"all" | "officialDirectory" | "eligibilityVerified">("all");
  const [sort, setSort] = useState<"deadline" | "name" | "category" | "reviewed" | "provider">("deadline");
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }), [language]);
  const filters = useMemo(
    () => ({
      query: query.trim() || undefined,
      state: state === "all" ? undefined : state,
      category: category === "all" ? undefined : category,
      level: level === "all" ? undefined : level,
      deadline: deadline === "all" ? undefined : deadline,
      administeringBody: administeringBody === "all" ? undefined : administeringBody,
      verificationStatus: verificationStatus === "all" ? undefined : verificationStatus,
      sort,
    }),
    [administeringBody, category, deadline, level, query, sort, state, verificationStatus]
  );
  const catalog = trpc.schemes.list.useQuery(filters, { staleTime: 60_000 });
  const filterOptions = trpc.schemes.filterOptions.useQuery(undefined, { staleTime: 60_000 });
  const schemes = catalog.data?.schemes ?? [];
  const hasFilters = Boolean(
    query ||
      state !== "all" ||
      category !== "all" ||
      level !== "all" ||
      deadline !== "all" ||
      administeringBody !== "all" ||
      verificationStatus !== "all" ||
      sort !== "deadline"
  );
  const resetFilters = () => {
    setQuery("");
    setState("all");
    setCategory("all");
    setLevel("all");
    setDeadline("all");
    setAdministeringBody("all");
    setVerificationStatus("all");
    setSort("deadline");
  };

  return (
    <main className="discover-page">
      <header className="discover-header">
        <button onClick={() => setLocation("/")}><ArrowLeft size={16} /> {language === "hi" ? "Scheme Sathi पर वापस जाएँ" : "Back to Scheme Sathi"}</button>
        <div className="discover-header-actions"><span>{language === "hi" ? "उन्नत खोज" : "ADVANCED DISCOVERY"}</span><button type="button" className="discover-language-toggle" onClick={() => setLanguage(current => current === "hi" ? "en" : "hi")} aria-pressed={language === "hi"}><Languages size={15} /> {language === "hi" ? "English" : "हिंदी"}</button></div>
      </header>
      <section className="discover-intro">
        <div>
          <p className="desk-kicker"><SlidersHorizontal size={14} /> {language === "hi" ? "अधिक सटीक खोज" : "FIND WITH MORE PRECISION"}</p>
          <h1>{language === "hi" ? <>अपने <em>स्थान, ज़रूरत और समयसीमा</em> से खोजें।</> : <>Search by your <em>place, need and deadline.</em></>}</h1>
          <p>{language === "hi" ? "स्रोत स्थिति, संचालक विभाग, शिक्षा स्तर और समयसीमा से विस्तृत छात्रवृत्ति निर्देशिका देखें। आवेदन से पहले आधिकारिक पोर्टल पर वर्तमान पात्रता और समयसीमा की पुष्टि ज़रूर करें।" : "Browse the expanded scholarship directory by source status, provider area, education level and deadline. Always confirm a deadline and current eligibility on the official portal before applying."}</p>
        </div>
        <div className="discover-count"><strong>{schemes.length}</strong><span>{language === "hi" ? "इस सूची में योजनाएँ" : "schemes in this view"}</span></div>
      </section>
      <section className="discover-workspace">
        <aside className="discover-filters">
          <div className="discover-filter-heading"><Filter size={17} /><strong>{discoverLabel("refine", language)}</strong>{hasFilters && <button type="button" onClick={resetFilters}><RotateCcw size={13} /> {discoverLabel("clear", language)}</button>}</div>
          <label>{discoverLabel("search", language)}<input value={query} onChange={event => setQuery(event.target.value)} placeholder={discoverLabel("searchPlaceholder", language)} /></label>
          <label>{discoverLabel("state", language)}<select value={state} onChange={event => setState(event.target.value)}><option value="all">{language === "hi" ? "पूरा भारत / कोई भी राज्य" : "All India / any state"}</option>{states.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>{discoverLabel("category", language)}<select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item.key} value={item.key}>{language === "hi" ? item.labelHi : item.label}</option>)}</select></label>
          <label>{discoverLabel("schemeLevel", language)}<select value={level} onChange={event => setLevel(event.target.value as typeof level)}><option value="all">{discoverLabel("allLevels", language)}</option><option value="Central">{discoverLabel("central", language)}</option><option value="State">{discoverLabel("stateLevel", language)}</option></select></label>
          <label>{discoverLabel("providerArea", language)}<select value={administeringBody} onChange={event => setAdministeringBody(event.target.value)} disabled={filterOptions.isLoading}><option value="all">{discoverLabel("allProviders", language)}</option>{filterOptions.data?.administeringBodies.map(provider => <option key={provider} value={provider}>{providerDisplayLabel(provider, language)}</option>)}</select></label>
          <label>{discoverLabel("sourceStatus", language)}<select value={verificationStatus} onChange={event => setVerificationStatus(event.target.value as typeof verificationStatus)}><option value="all">{discoverLabel("allSources", language)}</option><option value="officialDirectory">{discoverLabel("officialDirectory", language)}</option><option value="eligibilityVerified">{discoverLabel("eligibilityVerified", language)}</option></select></label>
          <label>{discoverLabel("deadline", language)}<select value={deadline} onChange={event => setDeadline(event.target.value as typeof deadline)}><option value="all">{discoverLabel("allDeadlines", language)}</option><option value="closingSoon">{discoverLabel("closingSoon", language)}</option><option value="announced">{discoverLabel("announced", language)}</option><option value="openEnded">{discoverLabel("openEnded", language)}</option></select></label>
          <label>{discoverLabel("sort", language)}<select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="deadline">{discoverLabel("deadlineSoonest", language)}</option><option value="reviewed">{discoverLabel("recentlyReviewed", language)}</option><option value="provider">{discoverLabel("providerSort", language)}</option><option value="name">{discoverLabel("name", language)}</option><option value="category">{discoverLabel("categorySort", language)}</option></select></label>
        </aside>
        <section className="discover-results" aria-live="polite">
          {catalog.isLoading && <div className="desk-empty">{language === "hi" ? "सत्यापित योजना डेटा लोड हो रहा है…" : "Loading verified scheme data…"}</div>}
          {catalog.isError && <div className="desk-empty"><Search size={24} /><h3>{language === "hi" ? "योजना डेटा लोड नहीं हो सका।" : "Scheme data could not load."}</h3><p>{language === "hi" ? "कृपया कुछ समय बाद फिर कोशिश करें।" : "Please try again in a moment."}</p></div>}
          {!catalog.isLoading && !catalog.isError && schemes.map(scheme => <article className="discover-scheme-card" key={scheme.id}>
            <div>
              <span className={`category-tag ${scheme.accent}`}>{language === "hi" ? scheme.categoryHindi : scheme.category}</span>
              <h2>{language === "hi" ? scheme.nameHindi : scheme.name}</h2>
              <p>{language === "hi" ? scheme.benefitsHindi : scheme.benefits}</p>
              <div className="discover-meta"><span>{language === "hi" ? scheme.level === "Central" ? "केंद्रीय योजना" : "राज्य योजना" : `${scheme.level} scheme`}</span><span>{providerDisplayLabel(scheme.administeringBody, language)}</span><span>{discoverLabel(scheme.verificationStatus ?? "officialDirectory", language)}</span></div>
            </div>
            <aside>
              {scheme.applicationDeadline ? <div className="discover-deadline"><CalendarClock size={17} /><span><strong>{dateFormat.format(new Date(scheme.applicationDeadline))}</strong><small>{language === "hi" ? scheme.deadlineLabel?.replace("Student applications close", "छात्र आवेदन की अंतिम तिथि") : scheme.deadlineLabel}</small></span></div> : <div className="discover-deadline muted"><CalendarClock size={17} /><span><strong>{language === "hi" ? "तारीख घोषित नहीं" : "No date announced"}</strong><small>{language === "hi" ? "अगली आवेदन अवधि के लिए आधिकारिक पोर्टल देखें।" : "Check the official portal for the next application window."}</small></span></div>}
              <a href={scheme.portalUrl} target="_blank" rel="noreferrer">{language === "hi" ? "आधिकारिक पोर्टल खोलें" : "Open official portal"}</a>
              {scheme.sourceUrl && scheme.sourceUrl !== scheme.portalUrl && <a className="discover-source-link" href={scheme.sourceUrl} target="_blank" rel="noreferrer">{language === "hi" ? "स्रोत निर्देशिका देखें" : "View source directory"}</a>}
            </aside>
          </article>)}
          {!catalog.isLoading && !catalog.isError && !schemes.length && <div className="desk-empty"><Search size={24} /><h3>{language === "hi" ? "इन फ़िल्टर से कोई योजना नहीं मिली।" : "No schemes match these filters."}</h3><p>{language === "hi" ? "दूसरा संचालक विभाग, स्रोत स्थिति, श्रेणी या समयसीमा चुनकर देखें।" : "Try another provider area, source status, category, or deadline window."}</p>{hasFilters && <button type="button" className="desk-secondary" onClick={resetFilters}>{language === "hi" ? "फ़िल्टर साफ़ करें" : "Clear filters"}</button>}</div>}
        </section>
      </section>
    </main>
  );
}
