import { trpc } from "@/lib/trpc";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { filterVerificationHistoryByQuery, historyPreviewFeedback, verificationHistoryLabels } from "@/lib/verificationHistory";
import { CalendarDays, Download, Eye, FileText, History, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const toDateInput = (timestamp: number | undefined) => timestamp ? new Date(timestamp - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10) : "";

type HistoryEvent = { documentId?: number; documentName: string; fileName: string; mimeType?: string; schemeName: string; kind: string; detail: string | null; createdAt: number };

function useDebouncedValue(value: string, delay = 180) { const [debounced, setDebounced] = useState(value); useEffect(() => { const timeout = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timeout); }, [delay, value]); return debounced; }

function HistoryDocumentPreview({ event }: { event: HistoryEvent }) {
  const [open, setOpen] = useState(false);
  const preview = trpc.documents.preview.useQuery({ documentId: event.documentId ?? 0 }, { enabled: open && Boolean(event.documentId), retry: false, staleTime: 0 });
  if (!event.documentId) return null;
  return <HoverCard open={open} onOpenChange={setOpen} openDelay={260} closeDelay={140}><HoverCardTrigger asChild><button className="history-preview-trigger" type="button" aria-label={`Quick preview of ${event.fileName}`}><Eye size={13} />Quick glance</button></HoverCardTrigger><HoverCardContent className="history-preview-card" align="end"><div className="history-preview-heading"><Eye size={14} /><span><strong>{event.documentName}</strong><small>Private hover preview</small></span></div>{preview.isLoading && <div className="history-preview-loading"><Loader2 className="spin" size={16} />{historyPreviewFeedback("loading")}</div>}{preview.isError && <div className="history-preview-loading">{historyPreviewFeedback("unavailable")}</div>}{preview.data?.preview && <div className="history-preview-stage">{preview.data.preview.mimeType === "application/pdf" ? <iframe title={`Quick preview of ${preview.data.preview.fileName}`} src={preview.data.preview.url} /> : <img src={preview.data.preview.url} alt={`Quick preview of ${preview.data.preview.fileName}`} />}</div>}<small className="history-preview-note">Visible only to your signed-in account. The secure link loads on hover or keyboard focus.</small></HoverCardContent></HoverCard>;
}

export function DocumentHistoryTools() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const filters = useMemo(() => ({ startAt: startDate ? new Date(`${startDate}T00:00:00`).getTime() : undefined, endAt: endDate ? new Date(`${endDate}T23:59:59`).getTime() : undefined, sort }), [endDate, sort, startDate]);
  const history = trpc.documents.history.useQuery(filters);
  const matchingEvents = useMemo(() => filterVerificationHistoryByQuery(history.data?.events ?? [], debouncedSearch), [debouncedSearch, history.data?.events]);
  const exportPdf = trpc.documents.exportHistoryPdf.useMutation({
    onSuccess: ({ base64Data, fileName, eventCount }) => {
      const bytes = Uint8Array.from(atob(base64Data), (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = fileName; link.click(); URL.revokeObjectURL(link.href);
      toast.success(`${eventCount} timeline event${eventCount === 1 ? "" : "s"} exported as PDF.`);
    },
    onError: () => toast.error("Your verification history PDF could not be created."),
  });

  return <section className="history-tools"><div className="history-tools-heading"><div><span className="desk-kicker"><History size={14} /> VERIFICATION HISTORY</span><h2>Find and keep your past actions.</h2><p>Filter document activity by date, search names or keywords, change the order, or download the selected history as a private PDF.</p></div><button className="desk-primary" disabled={exportPdf.isPending} onClick={() => exportPdf.mutate(filters)}>{exportPdf.isPending ? <Loader2 className="spin" size={15} /> : <Download size={15} />} Export PDF</button></div><div className="history-filter-bar"><label className="history-search"><Search size={14} />Quick search<input type="search" value={search} placeholder="Document, scheme, action or note" onChange={(event) => setSearch(event.target.value)} /></label><label><CalendarDays size={14} />From<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label><label><CalendarDays size={14} />To<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label><label><SlidersHorizontal size={14} />Order<select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label><button onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); setSort("newest"); }}>Clear filters</button></div><div className="history-results">{history.isLoading && <span><Loader2 className="spin" size={15} /> Loading your document history…</span>}{!history.isLoading && !history.data?.events.length && <span><FileText size={15} /> No activity matches this date range yet.</span>}{!history.isLoading && Boolean(history.data?.events.length) && !matchingEvents.length && <span><Search size={15} /> No activity matches “{search.trim()}”.</span>}{matchingEvents.slice(0, 8).map((event, index) => <div className="history-result-row" key={`${event.createdAt}-${index}`}><time>{dateFormat.format(new Date(event.createdAt))}</time><div><strong>{event.documentName}</strong><span>{verificationHistoryLabels[event.kind] ?? event.kind.replace(/([A-Z])/g, " $1")}</span><small>{event.schemeName} · {event.detail ?? "No additional note"}</small></div><HistoryDocumentPreview event={event} /></div>)}{matchingEvents.length > 8 && <small className="history-more">Showing the first 8 matches in the dashboard. The PDF includes all activity in the selected date range.</small>}</div></section>;
}
