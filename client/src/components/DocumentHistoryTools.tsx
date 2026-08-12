import { trpc } from "@/lib/trpc";
import { CalendarDays, Download, FileText, History, Loader2, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const toDateInput = (timestamp: number | undefined) => timestamp ? new Date(timestamp - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10) : "";

export function DocumentHistoryTools() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const filters = useMemo(() => ({ startAt: startDate ? new Date(`${startDate}T00:00:00`).getTime() : undefined, endAt: endDate ? new Date(`${endDate}T23:59:59`).getTime() : undefined, sort }), [endDate, sort, startDate]);
  const history = trpc.documents.history.useQuery(filters);
  const exportPdf = trpc.documents.exportHistoryPdf.useMutation({
    onSuccess: ({ base64Data, fileName, eventCount }) => {
      const bytes = Uint8Array.from(atob(base64Data), (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = fileName; link.click(); URL.revokeObjectURL(link.href);
      toast.success(`${eventCount} timeline event${eventCount === 1 ? "" : "s"} exported as PDF.`);
    },
    onError: () => toast.error("Your verification history PDF could not be created."),
  });

  return <section className="history-tools"><div className="history-tools-heading"><div><span className="desk-kicker"><History size={14} /> VERIFICATION HISTORY</span><h2>Find and keep your past actions.</h2><p>Filter document activity by date, change the order, or download the selected history as a private PDF.</p></div><button className="desk-primary" disabled={exportPdf.isPending} onClick={() => exportPdf.mutate(filters)}>{exportPdf.isPending ? <Loader2 className="spin" size={15} /> : <Download size={15} />} Export PDF</button></div><div className="history-filter-bar"><label><CalendarDays size={14} />From<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label><label><CalendarDays size={14} />To<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label><label><SlidersHorizontal size={14} />Order<select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label><button onClick={() => { setStartDate(""); setEndDate(""); setSort("newest"); }}>Clear filters</button></div><div className="history-results">{history.isLoading && <span><Loader2 className="spin" size={15} /> Loading your document history…</span>}{!history.isLoading && !history.data?.events.length && <span><FileText size={15} /> No activity matches this range yet.</span>}{history.data?.events.slice(0, 8).map((event, index) => <div className="history-result-row" key={`${event.createdAt}-${index}`}><time>{dateFormat.format(new Date(event.createdAt))}</time><div><strong>{event.documentName}</strong><span>{event.kind.replace(/([A-Z])/g, " $1")}</span><small>{event.schemeName} · {event.detail ?? "No additional note"}</small></div></div>)}{(history.data?.events.length ?? 0) > 8 && <small className="history-more">Showing the latest 8 events in the dashboard. The PDF includes all matching activity.</small>}</div></section>;
}
