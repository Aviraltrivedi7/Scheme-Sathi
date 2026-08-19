import { categories, states } from "@/lib/schemes";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CalendarClock, Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const verificationLabel = {
  officialDirectory: "Official directory listed",
  eligibilityVerified: "Eligibility verified",
} as const;

export default function Discover() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState<"all" | "Central" | "State">("all");
  const [deadline, setDeadline] = useState<"all" | "announced" | "closingSoon" | "openEnded">("all");
  const [administeringBody, setAdministeringBody] = useState("all");
  const [verificationStatus, setVerificationStatus] = useState<"all" | "officialDirectory" | "eligibilityVerified">("all");
  const [sort, setSort] = useState<"deadline" | "name" | "category" | "reviewed" | "provider">("deadline");
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
        <button onClick={() => setLocation("/")}><ArrowLeft size={16} /> Back to Scheme Sathi</button>
        <span>ADVANCED DISCOVERY</span>
      </header>
      <section className="discover-intro">
        <div>
          <p className="desk-kicker"><SlidersHorizontal size={14} /> FIND WITH MORE PRECISION</p>
          <h1>Search by your <em>place, need and deadline.</em></h1>
          <p>Browse the expanded scholarship directory by source status, provider area, education level and deadline. Always confirm a deadline and current eligibility on the official portal before applying.</p>
        </div>
        <div className="discover-count"><strong>{schemes.length}</strong><span>schemes in this view</span></div>
      </section>
      <section className="discover-workspace">
        <aside className="discover-filters">
          <div className="discover-filter-heading"><Filter size={17} /><strong>Refine schemes</strong>{hasFilters && <button type="button" onClick={resetFilters}><RotateCcw size={13} /> Clear</button>}</div>
          <label>Search<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Scheme, benefit or provider" /></label>
          <label>State / UT<select value={state} onChange={event => setState(event.target.value)}><option value="all">All India / any state</option>{states.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          <label>Scheme level<select value={level} onChange={event => setLevel(event.target.value as typeof level)}><option value="all">Central and state schemes</option><option value="Central">Central schemes</option><option value="State">State schemes</option></select></label>
          <label>Provider area<select value={administeringBody} onChange={event => setAdministeringBody(event.target.value)} disabled={filterOptions.isLoading}><option value="all">All ministries and providers</option>{filterOptions.data?.administeringBodies.map(provider => <option key={provider} value={provider}>{provider}</option>)}</select></label>
          <label>Source status<select value={verificationStatus} onChange={event => setVerificationStatus(event.target.value as typeof verificationStatus)}><option value="all">All source statuses</option><option value="officialDirectory">Official directory listed</option><option value="eligibilityVerified">Eligibility verified</option></select></label>
          <label>Application deadline<select value={deadline} onChange={event => setDeadline(event.target.value as typeof deadline)}><option value="all">Any deadline status</option><option value="closingSoon">Closing within 90 days</option><option value="announced">Deadline announced</option><option value="openEnded">No deadline announced</option></select></label>
          <label>Sort by<select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="deadline">Deadline soonest</option><option value="reviewed">Recently reviewed</option><option value="provider">Provider area</option><option value="name">Name</option><option value="category">Category</option></select></label>
        </aside>
        <section className="discover-results" aria-live="polite">
          {catalog.isLoading && <div className="desk-empty">Loading verified scheme data…</div>}
          {catalog.isError && <div className="desk-empty"><Search size={24} /><h3>Scheme data could not load.</h3><p>Please try again in a moment.</p></div>}
          {!catalog.isLoading && !catalog.isError && schemes.map(scheme => <article className="discover-scheme-card" key={scheme.id}>
            <div>
              <span className={`category-tag ${scheme.accent}`}>{scheme.category}</span>
              <h2>{scheme.name}</h2>
              <p>{scheme.benefits}</p>
              <div className="discover-meta"><span>{scheme.level} scheme</span><span>{scheme.administeringBody}</span><span>{verificationLabel[scheme.verificationStatus ?? "officialDirectory"]}</span></div>
            </div>
            <aside>
              {scheme.applicationDeadline ? <div className="discover-deadline"><CalendarClock size={17} /><span><strong>{dateFormat.format(new Date(scheme.applicationDeadline))}</strong><small>{scheme.deadlineLabel}</small></span></div> : <div className="discover-deadline muted"><CalendarClock size={17} /><span><strong>No date announced</strong><small>Check the official portal for the next application window.</small></span></div>}
              <a href={scheme.portalUrl} target="_blank" rel="noreferrer">Open official portal</a>
              {scheme.sourceUrl && scheme.sourceUrl !== scheme.portalUrl && <a className="discover-source-link" href={scheme.sourceUrl} target="_blank" rel="noreferrer">View source directory</a>}
            </aside>
          </article>)}
          {!catalog.isLoading && !catalog.isError && !schemes.length && <div className="desk-empty"><Search size={24} /><h3>No schemes match these filters.</h3><p>Try another provider area, source status, category, or deadline window.</p>{hasFilters && <button type="button" className="desk-secondary" onClick={resetFilters}>Clear filters</button>}</div>}
        </section>
      </section>
    </main>
  );
}
