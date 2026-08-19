import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Copy, Inbox, Link2, Loader2, Plus, Search, ShieldCheck, UsersRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import "./PilotAdmin.css";

type FeedbackStatus = "new" | "reviewed" | "followUp" | "archived";

const statusLabel: Record<FeedbackStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  followUp: "Follow-up",
  archived: "Archived",
};

export default function PilotAdmin() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<FeedbackStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const feedbackInput = useMemo(
    () => ({ status: status === "all" ? undefined : status, query: query.trim() || undefined }),
    [status, query]
  );
  const feedbackQuery = trpc.admin.pilot.feedback.list.useQuery(feedbackInput, { enabled: user?.role === "admin" });
  const feedbackSummaryQuery = trpc.admin.pilot.feedback.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const inviteQuery = trpc.admin.pilot.cohorts.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const conversionQuery = trpc.admin.pilot.cohorts.conversionStats.useQuery(undefined, { enabled: user?.role === "admin" });
  const [inviteDraft, setInviteDraft] = useState({ cohortName: "", cohortType: "college" as "college" | "ngo", maxUses: "50", expiresAt: "" });
  const [noteDraft, setNoteDraft] = useState("");
  const selected = feedbackQuery.data?.feedback.find(item => item.id === selectedId) ?? feedbackQuery.data?.feedback[0] ?? null;

  useEffect(() => {
    setSelectedId(selected?.id ?? null);
    setNoteDraft(selected?.adminNote ?? "");
  }, [selected?.id]);

  const createInvite = trpc.admin.pilot.cohorts.create.useMutation({
    onSuccess: async () => {
      await utils.admin.pilot.cohorts.list.invalidate();
      await utils.admin.pilot.cohorts.conversionStats.invalidate();
      setInviteDraft({ cohortName: "", cohortType: "college", maxUses: "50", expiresAt: "" });
      toast.success("Cohort invite created.");
    },
    onError: error => toast.error(error.message),
  });
  const revokeInvite = trpc.admin.pilot.cohorts.revoke.useMutation({
    onSuccess: async () => {
      await utils.admin.pilot.cohorts.list.invalidate();
      await utils.admin.pilot.cohorts.conversionStats.invalidate();
      toast.success("Invite revoked.");
    },
    onError: error => toast.error(error.message),
  });
  const updateFeedback = trpc.admin.pilot.feedback.update.useMutation({
    onSuccess: async () => {
      await utils.admin.pilot.feedback.list.invalidate();
      toast.success("Feedback updated.");
    },
    onError: error => toast.error(error.message),
  });

  const copyInvite = async (code: string) => {
    const url = `${window.location.origin}/pilot?cohort=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Cohort link copied.");
    } catch {
      toast.error("Copy failed. Please copy the link from the browser address bar.");
    }
  };
  const feedback = feedbackQuery.data?.feedback ?? [];
  const allFeedback = feedbackSummaryQuery.data?.feedback ?? [];
  const metrics = (Object.keys(statusLabel) as FeedbackStatus[]).map(key => ({ key, value: allFeedback.filter(item => item.status === key).length }));
  const journeyCounts = allFeedback.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.journeyStage]: (counts[item.journeyStage] ?? 0) + 1 }), {});
  const conversions = conversionQuery.data?.cohorts ?? [];

  if (user?.role !== "admin") {
    return <DashboardLayout><div className="pilot-admin-denied"><ShieldCheck size={30} /><h1>Administrator access required</h1><p>This workspace is only available to Scheme Sathi administrators.</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="pilot-admin">
        <header className="pilot-admin-masthead">
          <div><p className="desk-kicker"><Inbox size={14} /> PILOT OPERATIONS</p><h1>Turn responses into <em>better journeys.</em></h1><p>Review structured scholarship-pilot feedback, record follow-up decisions, and generate revocable links for college and NGO cohorts.</p></div>
          <div className="pilot-admin-source"><ShieldCheck size={17} /><span>Feedback contains only the submitted pilot fields. No documents or profile are shown here.</span></div>
        </header>

        <section className="pilot-admin-metrics" aria-label="Pilot feedback summary">
          {metrics.map(metric => <button key={metric.key} className={status === metric.key ? "active" : ""} onClick={() => setStatus(status === metric.key ? "all" : metric.key)}><span>{statusLabel[metric.key]}</span><strong>{metric.value}</strong></button>)}
          <div className="pilot-journey-summary"><BarChart3 size={16} /><span>{Object.entries(journeyCounts).length ? Object.entries(journeyCounts).map(([stage, count]) => `${count} ${stage.replace(/([A-Z])/g, " $1")}`).join(" · ") : "No submitted responses yet"}</span></div>
        </section>

        <section className="pilot-admin-grid">
          <section className="pilot-inbox-card">
            <div className="pilot-card-heading"><div><p className="desk-kicker"><Inbox size={14} /> FEEDBACK INBOX</p><h2>What cohorts are telling us</h2></div><label className="pilot-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search blocker or state" /></label></div>
            <div className="pilot-status-tabs">{(["all", ...Object.keys(statusLabel)] as (FeedbackStatus | "all")[]).map(item => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item === "all" ? "All" : statusLabel[item]}</button>)}</div>
            {feedbackQuery.isLoading ? <div className="pilot-empty"><Loader2 className="spin" size={24} /> Loading feedback…</div> : feedback.length === 0 ? <div className="pilot-empty"><Inbox size={25} /><h3>No feedback in this view</h3><p>Feedback submitted through the pilot landing page will appear here. No test response has been inserted.</p></div> : <div className="pilot-feedback-list">{feedback.map(item => <button key={item.id} className={`pilot-feedback-item ${selected?.id === item.id ? "active" : ""}`} onClick={() => setSelectedId(item.id)}><div><span className={`pilot-status status-${item.status}`}>{statusLabel[item.status]}</span><strong>{item.role.replace(/([A-Z])/g, " $1")}</strong></div><p>{item.biggestBlocker}</p><small>{item.cohortName ?? "Public pilot"} · {new Date(item.createdAt).toLocaleDateString()}</small></button>)}</div>}
          </section>

          <aside className="pilot-detail-card">
            {selected ? <><div className="pilot-card-heading"><div><p className="desk-kicker">RESPONSE DETAIL</p><h2>{selected.cohortName ?? "Public pilot"}</h2></div><span className={`pilot-status status-${selected.status}`}>{statusLabel[selected.status]}</span></div><dl className="pilot-detail-list"><div><dt>Role</dt><dd>{selected.role.replace(/([A-Z])/g, " $1")}</dd></div><div><dt>State / UT</dt><dd>{selected.state}</dd></div><div><dt>Journey</dt><dd>{selected.journeyStage.replace(/([A-Z])/g, " $1")}</dd></div><div className="full"><dt>Biggest blocker</dt><dd>{selected.biggestBlocker}</dd></div><div className="full"><dt>Would help today</dt><dd>{selected.helpfulToday}</dd></div></dl><label className="pilot-admin-field">Status<select value={selected.status} onChange={event => updateFeedback.mutate({ feedbackId: selected.id, status: event.target.value as FeedbackStatus, adminNote: noteDraft || null })}>{(Object.keys(statusLabel) as FeedbackStatus[]).map(item => <option key={item} value={item}>{statusLabel[item]}</option>)}</select></label><label className="pilot-admin-field">Internal follow-up note<textarea value={noteDraft} maxLength={1000} onChange={event => setNoteDraft(event.target.value)} placeholder="Visible only to administrators" /></label><button className="desk-primary" disabled={updateFeedback.isPending} onClick={() => updateFeedback.mutate({ feedbackId: selected.id, status: selected.status, adminNote: noteDraft || null })}>{updateFeedback.isPending ? <Loader2 className="spin" size={15} /> : <CheckCircle2 size={15} />} Save response review</button></> : <div className="pilot-empty"><Inbox size={25} /><h3>Select a response</h3><p>Open a feedback item to assign status or record an internal note.</p></div>}
          </aside>
        </section>

        <section className="pilot-conversion-card" aria-label="Cohort conversion funnel">
          <div className="pilot-card-heading"><div><p className="desk-kicker"><BarChart3 size={14} /> CONVERSION FUNNEL</p><h2>See which cohorts become accounts</h2><p>Counts are aggregate-only: one anonymised browser visit, feedback submissions, and first account attribution per active cohort link.</p></div></div>
          {conversionQuery.isLoading ? <div className="pilot-empty"><Loader2 className="spin" size={20} /> Loading cohort conversion…</div> : conversions.length ? <div className="pilot-funnel-table-wrap"><table className="pilot-funnel-table"><thead><tr><th>Cohort</th><th>Link visits</th><th>Feedback</th><th>Signed up</th><th>Visit → signup</th><th>Status</th></tr></thead><tbody>{conversions.map(cohort => <tr key={cohort.inviteId}><td><strong>{cohort.cohortName}</strong><small>{cohort.cohortType}</small></td><td>{cohort.linkVisits}</td><td>{cohort.feedbackSubmissions}<small>{cohort.feedbackRate}% of visits</small></td><td>{cohort.accountSignups}</td><td><span className="pilot-conversion-rate">{cohort.signupRate}%</span></td><td><span className={cohort.active ? "pilot-funnel-status active" : "pilot-funnel-status"}>{cohort.active ? "Active" : "Closed"}</span></td></tr>)}</tbody></table></div> : <div className="pilot-empty"><BarChart3 size={24} /><h3>No cohort funnel data yet</h3><p>Create and share a cohort link to begin aggregate conversion measurement. No visitor or account details will appear here.</p></div>}
        </section>

        <section className="pilot-cohorts-card">
          <div className="pilot-card-heading"><div><p className="desk-kicker"><UsersRound size={14} /> COHORT INVITES</p><h2>Invite a college or NGO cohort</h2><p>Each generated link is unique, has a use limit, and can be revoked at any time.</p></div></div>
          <form className="pilot-invite-form" onSubmit={event => { event.preventDefault(); createInvite.mutate({ cohortName: inviteDraft.cohortName, cohortType: inviteDraft.cohortType, maxUses: Number(inviteDraft.maxUses), expiresAt: inviteDraft.expiresAt ? new Date(inviteDraft.expiresAt).getTime() : null }); }}><label>Cohort name<input value={inviteDraft.cohortName} maxLength={120} onChange={event => setInviteDraft({ ...inviteDraft, cohortName: event.target.value })} placeholder="For example, Pune college scholarship cell" required /></label><label>Type<select value={inviteDraft.cohortType} onChange={event => setInviteDraft({ ...inviteDraft, cohortType: event.target.value as "college" | "ngo" })}><option value="college">College</option><option value="ngo">NGO</option></select></label><label>Maximum responses<input type="number" min="1" max="500" value={inviteDraft.maxUses} onChange={event => setInviteDraft({ ...inviteDraft, maxUses: event.target.value })} required /></label><label>Expiry (optional)<input type="datetime-local" value={inviteDraft.expiresAt} onChange={event => setInviteDraft({ ...inviteDraft, expiresAt: event.target.value })} /></label><button className="desk-primary" disabled={createInvite.isPending}>{createInvite.isPending ? <Loader2 className="spin" size={15} /> : <Plus size={15} />} Create invite</button></form>
          <div className="pilot-invite-list">{inviteQuery.isLoading ? <div className="pilot-empty"><Loader2 className="spin" size={20} /> Loading cohort invites…</div> : inviteQuery.data?.invites.length ? inviteQuery.data.invites.map(invite => <article key={invite.id} className={!invite.active ? "inactive" : ""}><div><span className="pilot-invite-type">{invite.cohortType}</span><h3>{invite.cohortName}</h3><p>{invite.usedCount} / {invite.maxUses} responses · {invite.expiresAt ? `Expires ${new Date(invite.expiresAt).toLocaleDateString()}` : "No expiry"}</p></div><div className="pilot-invite-actions"><button onClick={() => copyInvite(invite.code)} disabled={!invite.active}><Copy size={14} /> Copy link</button><button onClick={() => revokeInvite.mutate({ inviteId: invite.id })} disabled={!invite.active || revokeInvite.isPending}><XCircle size={14} /> Revoke</button></div></article>) : <div className="pilot-empty"><Link2 size={24} /><h3>No cohort links yet</h3><p>Create a time-limited college or NGO invite above to start a tracked pilot cohort.</p></div>}</div>
        </section>
      </div>
    </DashboardLayout>
  );
}
