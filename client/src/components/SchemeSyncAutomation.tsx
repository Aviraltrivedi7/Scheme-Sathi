import { trpc } from "@/lib/trpc";
import { BellRing, CheckCircle2, CloudDownload, Loader2, Plus, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const kinds = ["manual", "datagov", "myscheme", "rss", "pib"] as const;

const kindHelp: Record<string, string> = {
  manual: "Any URL returning a JSON list of schemes.",
  datagov: "data.gov.in CKAN datastore_search API URL (needs your API key in the URL).",
  myscheme: "myScheme directory JSON endpoint.",
  rss: "RSS/Atom feed URL — new items arrive as review drafts.",
  pib: "PIB press-release listing — only scheme-like announcements are picked, no key needed.",
};

export default function SchemeSyncAutomation({ isAdmin }: { isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const sources = trpc.admin.schemeSync.sources.useQuery(undefined, { enabled: isAdmin });
  const runs = trpc.admin.schemeSync.runs.useQuery({ limit: 10 }, { enabled: isAdmin });
  const pending = trpc.admin.schemeSync.pending.useQuery({ status: "pending", limit: 30 }, { enabled: isAdmin });
  const automation = trpc.admin.schemeSync.automationStatus.useQuery(undefined, { enabled: isAdmin });
  const worker = trpc.admin.schemeSync.workerStatus.useQuery(undefined, { enabled: isAdmin, refetchInterval: 60_000 });
  const [draft, setDraft] = useState({ name: "", kind: "manual" as (typeof kinds)[number], endpoint: "", autoPublish: true });

  const refresh = async () => {
    await utils.admin.schemeSync.sources.invalidate();
    await utils.admin.schemeSync.runs.invalidate();
    await utils.admin.schemeSync.pending.invalidate();
    await utils.admin.schemeSync.workerStatus.invalidate();
    await utils.schemes.list.invalidate();
  };

  const saveSource = trpc.admin.schemeSync.saveSource.useMutation({
    onSuccess: async () => {
      setDraft({ name: "", kind: "manual", endpoint: "", autoPublish: true });
      await refresh();
      toast.success("Scheme source saved. Enable it, then run Sync now.");
    },
    onError: error => toast.error(error.message || "The source could not be saved."),
  });
  const setEnabled = trpc.admin.schemeSync.setEnabled.useMutation({
    onSuccess: refresh,
    onError: () => toast.error("The source could not be updated."),
  });
  const triggerSync = trpc.admin.schemeSync.triggerSync.useMutation({
    onSuccess: async data => {
      await refresh();
      const total = data.results.reduce((sum, result: any) => sum + (result.newCount ?? 0), 0);
      toast.success(total ? `${total} new scheme(s) staged for review.` : "Sync finished — nothing new found.");
    },
    onError: error => toast.error(error.message || "Sync failed. Check the source URL."),
  });
  const approve = trpc.admin.schemeSync.approvePending.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Scheme published to the catalog.");
    },
    onError: () => toast.error("The scheme could not be published."),
  });
  const reject = trpc.admin.schemeSync.rejectPending.useMutation({
    onSuccess: refresh,
    onError: () => toast.error("The entry could not be rejected."),
  });
  const enableAutomation = trpc.admin.schemeSync.automationEnable.useMutation({
    onSuccess: async () => {
      await utils.admin.schemeSync.automationStatus.invalidate();
      await utils.admin.schemeSync.workerStatus.invalidate();
      toast.success("5-minute sync bot enabled.");
    },
    onError: () => toast.error("Publish the project before enabling the live sync bot."),
  });

  if (!isAdmin) return null;
  const busy = triggerSync.isPending;

  return (
    <section className="admin-automation-card" aria-label="Catalog automation">
      <div>
        <span className="desk-kicker"><CloudDownload size={14} /> CATALOG AUTOMATION</span>
        <h2>New schemes arrive on their own</h2>
        <p>
          The sync bot watches enabled sources <strong>every 5 minutes</strong> and publishes
          arrivals straight to the catalog — or press Sync now for an instant sweep. New
          sources default to auto-publish; switch one off to hold its arrivals in the
          review queue instead.
        </p>
        <p>
          <strong>
            {worker.data?.botLive
              ? `Bot live${worker.data.nextExecutionAt ? ` — next sweep ${new Date(worker.data.nextExecutionAt).toLocaleTimeString("en-IN")}` : ""}${worker.data.lastRunAt ? ` · last sweep ${new Date(worker.data.lastRunAt).toLocaleString("en-IN")}` : ""} · ${worker.data.enabledSources} source(s) watched`
              : "Bot idle — start MySQL and run pnpm db:push, then add and enable a source."}
          </strong>
        </p>
      </div>

      <div className="admin-form-grid">
        <label>Source name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. State agriculture portal" /></label>
        <label>Source kind
          <select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as typeof draft.kind })}>
            {kinds.map(kind => <option key={kind} value={kind}>{kind}</option>)}
          </select>
        </label>
        <label className="full">Endpoint URL<input type="url" value={draft.endpoint} onChange={event => setDraft({ ...draft, endpoint: event.target.value })} placeholder="https://…" /></label>
      </div>
      <small className="help-disclaimer">{kindHelp[draft.kind]}</small>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <label className="checker-checkbox" style={{ margin: 0 }}>
          <input type="checkbox" checked={draft.autoPublish} onChange={event => setDraft({ ...draft, autoPublish: event.target.checked })} />
          <span>Auto-publish arrivals (skip review queue)</span>
        </label>
        <button className="desk-primary" disabled={saveSource.isPending || !draft.name.trim() || !draft.endpoint.trim()} onClick={() => saveSource.mutate(draft)}>
          {saveSource.isPending ? <Loader2 className="spin" size={15} /> : <Plus size={15} />} Add source
        </button>
        <button className="desk-outline" disabled={busy} onClick={() => triggerSync.mutate({})}>
          {busy ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} Sync now
        </button>
        <button className="desk-outline" disabled={!!automation.data?.setting?.scheduleCronTaskUid || enableAutomation.isPending} onClick={() => enableAutomation.mutate()}>
          {enableAutomation.isPending ? <Loader2 className="spin" size={15} /> : <BellRing size={15} />}
          {automation.data?.setting?.scheduleCronTaskUid ? "5-minute bot active" : "Enable 5-minute bot"}
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <span className="desk-kicker">SOURCES</span>
        {sources.isLoading && <Loader2 className="spin" size={16} />}
        {sources.data?.sources.map(source => (
          <div key={source.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "6px 0", borderBottom: "1px solid var(--border, #eee)" }}>
            <strong>{source.name}</strong>
            <small>{source.kind} · {source.autoPublish ? "auto-publish" : "review queue"}</small>
            <small>{source.lastStatus ? `last: ${source.lastStatus}` : "never synced"}{source.lastError ? ` — ${source.lastError}` : ""}</small>
            <span style={{ flex: 1 }} />
            <button className="desk-outline" disabled={busy} onClick={() => triggerSync.mutate({ sourceId: source.id })}>Sync</button>
            <button className="desk-outline" disabled={setEnabled.isPending} onClick={() => setEnabled.mutate({ sourceId: source.id, enabled: !source.enabled })}>
              {source.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
        {!sources.isLoading && !sources.data?.sources.length && <p>No sources yet — the three official directory templates appear after the database migration.</p>}
      </div>

      <div style={{ marginTop: 12 }}>
        <span className="desk-kicker">REVIEW QUEUE ({pending.data?.pending.length ?? 0})</span>
        {pending.data?.pending.map(item => {
          const payload = item.payload as unknown as { name?: string; administeringBody?: string; portalUrl?: string };
          return (
            <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "6px 0", borderBottom: "1px solid var(--border, #eee)" }}>
              <div>
                <strong>{String(payload.name ?? item.externalId)}</strong>
                <br />
                <small>{String(payload.administeringBody ?? "")} · {String(payload.portalUrl ?? "")}</small>
              </div>
              <span style={{ flex: 1 }} />
              <button className="desk-primary" disabled={approve.isPending} onClick={() => approve.mutate({ pendingId: item.id })}>
                <CheckCircle2 size={15} /> Approve
              </button>
              <button className="desk-outline" disabled={reject.isPending} onClick={() => reject.mutate({ pendingId: item.id })}>
                <XCircle size={15} /> Reject
              </button>
            </div>
          );
        })}
        {!pending.isLoading && !pending.data?.pending.length && <p>Queue is empty. New arrivals will appear here for one-click publishing.</p>}
      </div>

      {!!runs.data?.runs.length && (
        <div style={{ marginTop: 12 }}>
          <span className="desk-kicker">RECENT RUNS</span>
          {runs.data?.runs.map(run => (
            <div key={run.id}><small>{run.sourceId} · {run.status} · fetched {run.fetchedCount}, new {run.newCount}, updated {run.updatedCount}{run.error ? ` — ${run.error}` : ""}</small></div>
          ))}
        </div>
      )}
    </section>
  );
}
