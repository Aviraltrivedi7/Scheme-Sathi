import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { applicationStatusCopy, applicationStatuses, type ApplicationStatus } from "@shared/applicationTracker";
import { useMemo, useState } from "react";
import { BellRing, CalendarClock, CheckCircle2, ClipboardList, ExternalLink, LayoutDashboard, Plus, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const inputDateTime = (timestamp: number) => new Date(timestamp - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function dueLabel(deadline: number | null) {
  if (!deadline) return "No deadline announced";
  const days = Math.ceil((deadline - Date.now()) / 86_400_000);
  if (days < 0) return "Deadline passed";
  if (days === 0) return "Due today";
  return `${days} days left`;
}

export default function Dashboard() {
  const utils = trpc.useUtils();
  const applicationsQuery = trpc.applications.list.useQuery();
  const catalogQuery = trpc.schemes.list.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const [schemeId, setSchemeId] = useState("");
  const [reminderTimes, setReminderTimes] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<"all" | ApplicationStatus>("all");
  const track = trpc.applications.track.useMutation({
    onSuccess: async () => { setSchemeId(""); await utils.applications.list.invalidate(); toast.success("Added to your Application Desk."); },
    onError: () => toast.error("We could not track that scheme. Please try again."),
  });
  const update = trpc.applications.update.useMutation({ onSuccess: async () => { await utils.applications.list.invalidate(); } });
  const createReminder = trpc.reminders.create.useMutation({
    onSuccess: async () => { await utils.applications.list.invalidate(); toast.success("Reminder scheduled. It will appear here after delivery."); },
    onError: () => toast.error("Publish this project first to activate scheduled reminders, then try again."),
  });
  const cancelReminder = trpc.reminders.cancel.useMutation({ onSuccess: async () => { await utils.applications.list.invalidate(); toast.message("Reminder cancelled."); } });

  const applications = applicationsQuery.data?.applications ?? [];
  const filtered = useMemo(() => applications.filter((application) => filter === "all" || application.status === filter), [applications, filter]);
  const counts = useMemo(() => ({ active: applications.filter((application) => ["considering", "preparing", "submitted"].includes(application.status)).length, submitted: applications.filter((application) => application.status === "submitted").length, due: applications.filter((application) => application.applicationDeadline && application.applicationDeadline >= Date.now() && application.applicationDeadline <= Date.now() + 30 * 86_400_000).length }), [applications]);
  const availableSchemes = (catalogQuery.data?.schemes ?? []).filter((scheme) => !applications.some((application) => application.schemeId === scheme.id));

  return <DashboardLayout>
    <div className="application-desk">
      <header className="desk-masthead"><div><span className="desk-kicker"><LayoutDashboard size={14} /> APPLICATION DESK</span><h1>Your applications, <em>made visible.</em></h1><p>Keep each scheme, deadline and next step in one calm workspace. Your application data is private to your account.</p></div><button className="desk-refresh" onClick={() => applicationsQuery.refetch()}><RefreshCw size={15} /> Refresh</button></header>

      <section className="desk-stats" aria-label="Application summary"><article><span className="desk-stat-icon saffron"><ClipboardList size={19} /></span><div><strong>{counts.active}</strong><small>active applications</small></div></article><article><span className="desk-stat-icon indigo"><CheckCircle2 size={19} /></span><div><strong>{counts.submitted}</strong><small>waiting for an update</small></div></article><article><span className="desk-stat-icon coral"><CalendarClock size={19} /></span><div><strong>{counts.due}</strong><small>deadline within 30 days</small></div></article></section>

      <section className="desk-add-card"><div><span className="desk-kicker">START TRACKING</span><h2>Add a scheme to your desk</h2><p>Track an application before or after you submit it. You can set your own deadline and reference later.</p></div><div className="desk-add-controls"><select value={schemeId} onChange={(event) => setSchemeId(event.target.value)}><option value="">Select a scheme</option>{availableSchemes.map((scheme) => <option value={scheme.id} key={scheme.id}>{scheme.name}</option>)}</select><button className="desk-primary" disabled={!schemeId || track.isPending} onClick={() => track.mutate({ schemeId })}><Plus size={16} /> {track.isPending ? "Adding…" : "Track scheme"}</button></div></section>

      <section className="desk-board"><div className="desk-board-heading"><div><span className="desk-kicker">YOUR WORKSPACE</span><h2>What needs your attention?</h2></div><div className="desk-status-filter">{(["all", ...applicationStatuses] as const).map((status) => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{status === "all" ? "All" : applicationStatusCopy[status].label}</button>)}</div></div>
        {applicationsQuery.isLoading && <div className="desk-empty"><RefreshCw className="spin" size={20} /><p>Loading your application desk…</p></div>}
        {!applicationsQuery.isLoading && !filtered.length && <div className="desk-empty"><Sparkles size={24} /><h3>{applications.length ? "No applications in this view." : "Your desk is ready when you are."}</h3><p>{applications.length ? "Choose another status to see more entries." : "Select a scheme above to track a deadline, application status and reminders."}</p></div>}
        <div className="desk-application-list">{filtered.sort((a, b) => (a.applicationDeadline ?? Number.MAX_SAFE_INTEGER) - (b.applicationDeadline ?? Number.MAX_SAFE_INTEGER)).map((application) => {
          const status = applicationStatusCopy[application.status];
          const reminderValue = reminderTimes[application.id] ?? inputDateTime(Date.now() + 24 * 60 * 60 * 1000);
          const pendingReminder = application.reminders.find((reminder) => reminder.status === "scheduled");
          const deliveredReminder = application.reminders.find((reminder) => reminder.status === "delivered");
          return <article className="desk-application-card" key={application.id}><div className="desk-card-main"><div className={`desk-scheme-mark ${application.scheme?.accent ?? "indigo"}`}>{application.scheme?.category?.slice(0, 1) ?? "S"}</div><div><div className="desk-card-meta"><span className={`status-chip ${status.tone}`}>{status.label}</span>{application.applicationDeadline && <span className="deadline-chip"><CalendarClock size={13} />{dueLabel(application.applicationDeadline)}</span>}</div><h3>{application.scheme?.name ?? application.schemeId}</h3><p>{application.deadlineLabel ?? "Add your own deadline to keep this application on track."}</p><div className="desk-card-details"><label>Status<select value={application.status} onChange={(event) => update.mutate({ trackedApplicationId: application.id, status: event.target.value as ApplicationStatus })}>{applicationStatuses.map((value) => <option key={value} value={value}>{applicationStatusCopy[value].label}</option>)}</select></label><label>Reference<input value={application.applicationReference ?? ""} placeholder="Application reference" onBlur={(event) => update.mutate({ trackedApplicationId: application.id, applicationReference: event.target.value || null })} /></label></div></div></div><aside className="desk-card-aside">{application.scheme && <a href={application.scheme.portalUrl} target="_blank" rel="noreferrer" className="desk-portal-link">Official portal <ExternalLink size={14} /></a>}{pendingReminder ? <div className="desk-reminder-live"><BellRing size={16} /><span>Reminder set for {dateFormat.format(new Date(pendingReminder.remindAt))}</span><button onClick={() => cancelReminder.mutate({ reminderId: pendingReminder.id })}>Cancel</button></div> : deliveredReminder ? <div className="desk-reminder-delivered"><CheckCircle2 size={16} /><span>Reminder delivered {dateFormat.format(new Date(deliveredReminder.deliveredAt ?? deliveredReminder.remindAt))}</span></div> : <div className="desk-reminder-form"><label><BellRing size={15} /> Set a reminder<input type="datetime-local" value={reminderValue} min={inputDateTime(Date.now() + 60_000)} onChange={(event) => setReminderTimes((current) => ({ ...current, [application.id]: event.target.value }))} /></label><button className="desk-outline" disabled={createReminder.isPending} onClick={() => createReminder.mutate({ trackedApplicationId: application.id, remindAt: new Date(reminderValue).getTime() })}>Schedule reminder</button></div>}</aside></article>;
        })}</div>
      </section>
    </div>
  </DashboardLayout>;
}
