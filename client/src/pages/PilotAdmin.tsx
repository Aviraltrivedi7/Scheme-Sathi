import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { downloadTextFile } from "@/lib/schemeExports";
import { createCohortConversionReportCsv } from "@/lib/pilotCohortReports";
import { getQuarterOverQuarterChange, summariseFunnelSegment } from "@/lib/pilotDashboardInsights";
import { createHindiPilotDashboardSummaryPrintHtml, createPilotDashboardSummary, openHindiPilotDashboardSummaryPdf } from "@/lib/pilotDashboardSummary";
import { createPilotDashboardSearch, parsePilotDashboardFilters } from "@/lib/pilotDashboardView";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type DragEvent, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { Archive, ArchiveRestore, BarChart3, CalendarRange, CheckCircle2, Copy, Download, Eye, GripVertical, Inbox, Link2, Loader2, Palette, Pin, Plus, RotateCcw, Search, ShieldCheck, UsersRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import "./PilotAdmin.css";

type FeedbackStatus = "new" | "reviewed" | "followUp" | "archived";

function dateBoundary(value: string, endOfDay = false) {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`).getTime();
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("hi-IN", { month: "short", year: "numeric" }).format(new Date(`${value}-01T00:00:00`));
}

function trendPeriodLabel(value: string, period: "month" | "quarter") {
  if (period === "month") return monthLabel(value);
  const match = /^(\d{4})-Q([1-4])$/.exec(value);
  return match ? `तिमाही ${match[2]}, ${match[1]}` : value;
}

function pointChangeLabel(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

function pointChangeTone(value: number) {
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}

const statusLabel: Record<FeedbackStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  followUp: "Follow-up",
  archived: "Archived",
};

const folderColorOptions = [
  { value: "saffron", label: "Saffron" },
  { value: "marigold", label: "Marigold" },
  { value: "teal", label: "Teal" },
  { value: "indigo", label: "Indigo" },
  { value: "plum", label: "Plum" },
  { value: "slate", label: "Slate" },
] as const;
type FolderColor = (typeof folderColorOptions)[number]["value"];

export default function PilotAdmin() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<FeedbackStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [initialDashboardFilters] = useState(() => parsePilotDashboardFilters(window.location.search));
  const [reportStartDate, setReportStartDate] = useState(initialDashboardFilters.from);
  const [reportEndDate, setReportEndDate] = useState(initialDashboardFilters.to);
  const [trendCohortType, setTrendCohortType] = useState<"all" | "college" | "ngo">(initialDashboardFilters.segment);
  const [trendPeriod, setTrendPeriod] = useState<"month" | "quarter">(initialDashboardFilters.view);
  const [dashboardViewName, setDashboardViewName] = useState("");
  const [selectedDashboardViewId, setSelectedDashboardViewId] = useState<number | null>(null);
  const [savedViewSearch, setSavedViewSearch] = useState("");
  const [folderDraft, setFolderDraft] = useState("");
  const [folderColorDraft, setFolderColorDraft] = useState<FolderColor>("saffron");
  const [folderFilter, setFolderFilter] = useState("");
  const [savedViewScope, setSavedViewScope] = useState<"active" | "archived">("active");
  const [folderRenameDraft, setFolderRenameDraft] = useState("");
  const [selectedSavedViewIds, setSelectedSavedViewIds] = useState<number[]>([]);
  const [bulkFolderDraft, setBulkFolderDraft] = useState("");
  const [bulkFolderColorDraft, setBulkFolderColorDraft] = useState<FolderColor>("saffron");
  const [draggedViewId, setDraggedViewId] = useState<number | null>(null);
  const [summaryLanguage, setSummaryLanguage] = useState<"en" | "hi">("en");
  const [pdfHeaderDraft, setPdfHeaderDraft] = useState("सरकारी योजना पायलट · समेकित रिपोर्ट");
  const [pdfFooterDraft, setPdfFooterDraft] = useState("केवल आंतरिक उपयोग के लिए · व्यक्तिगत डेटा शामिल नहीं है");
  const [pdfLogoDraft, setPdfLogoDraft] = useState<"schemeSathi" | "janSeva" | "custom" | "none">("schemeSathi");
  const [pdfCustomLogoUrlDraft, setPdfCustomLogoUrlDraft] = useState("");
  const [pdfDateFormatDraft, setPdfDateFormatDraft] = useState<"long" | "short" | "iso">("long");
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const feedbackInput = useMemo(
    () => ({ status: status === "all" ? undefined : status, query: query.trim() || undefined }),
    [status, query]
  );
  const feedbackQuery = trpc.admin.pilot.feedback.list.useQuery(feedbackInput, { enabled: user?.role === "admin" });
  const feedbackSummaryQuery = trpc.admin.pilot.feedback.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const inviteQuery = trpc.admin.pilot.cohorts.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const savedViewsQuery = trpc.admin.pilot.views.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const reportRange = useMemo(() => ({
    startAt: dateBoundary(reportStartDate),
    endAt: dateBoundary(reportEndDate, true),
  }), [reportEndDate, reportStartDate]);
  const reportRangeInvalid = Boolean(reportRange.startAt && reportRange.endAt && reportRange.startAt > reportRange.endAt);
  const cohortAnalyticsInput = useMemo(() => ({ ...reportRange, cohortType: trendCohortType === "all" ? undefined : trendCohortType }), [reportRange, trendCohortType]);
  const conversionQuery = trpc.admin.pilot.cohorts.conversionStats.useQuery(cohortAnalyticsInput, { enabled: user?.role === "admin" && !reportRangeInvalid });
  const monthlyTrendInput = useMemo(() => ({ ...cohortAnalyticsInput, period: trendPeriod }), [cohortAnalyticsInput, trendPeriod]);
  const monthlyTrendQuery = trpc.admin.pilot.cohorts.monthlyTrend.useQuery(monthlyTrendInput, { enabled: user?.role === "admin" && !reportRangeInvalid });
  const [inviteDraft, setInviteDraft] = useState({ cohortName: "", cohortType: "college" as "college" | "ngo", maxUses: "50", expiresAt: "" });
  const [noteDraft, setNoteDraft] = useState("");
  const selected = feedbackQuery.data?.feedback.find(item => item.id === selectedId) ?? feedbackQuery.data?.feedback[0] ?? null;

  useEffect(() => {
    setSelectedId(selected?.id ?? null);
    setNoteDraft(selected?.adminNote ?? "");
  }, [selected?.id]);

  useEffect(() => {
    const search = createPilotDashboardSearch({ from: reportStartDate, to: reportEndDate, segment: trendCohortType, view: trendPeriod });
    if (window.location.search !== search) window.history.replaceState(null, "", `${window.location.pathname}${search}`);
  }, [reportEndDate, reportStartDate, trendCohortType, trendPeriod]);

  const createInvite = trpc.admin.pilot.cohorts.create.useMutation({
    onSuccess: async () => {
      await utils.admin.pilot.cohorts.list.invalidate();
      await utils.admin.pilot.cohorts.conversionStats.invalidate();
      await utils.admin.pilot.cohorts.monthlyTrend.invalidate();
      setInviteDraft({ cohortName: "", cohortType: "college", maxUses: "50", expiresAt: "" });
      toast.success("Cohort invite created.");
    },
    onError: error => toast.error(error.message),
  });
  const revokeInvite = trpc.admin.pilot.cohorts.revoke.useMutation({
    onSuccess: async () => {
      await utils.admin.pilot.cohorts.list.invalidate();
      await utils.admin.pilot.cohorts.conversionStats.invalidate();
      await utils.admin.pilot.cohorts.monthlyTrend.invalidate();
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
  const saveDashboardView = trpc.admin.pilot.views.save.useMutation({
    onSuccess: async ({ view }) => {
      setSelectedDashboardViewId(view.id);
      setDashboardViewName(view.name);
      setFolderDraft(view.folder ?? "");
      setFolderColorDraft((view.folderColor as FolderColor | null) ?? "saffron");
      await utils.admin.pilot.views.list.invalidate();
      toast.success("Dashboard view saved.");
    },
    onError: error => toast.error(error.message),
  });
  const deleteDashboardView = trpc.admin.pilot.views.delete.useMutation({
    onSuccess: async () => {
      setSelectedDashboardViewId(null);
      setDashboardViewName("");
      setFolderDraft("");
      setFolderColorDraft("saffron");
      await utils.admin.pilot.views.list.invalidate();
      toast.success("Saved dashboard view removed.");
    },
    onError: error => toast.error(error.message),
  });
  const setDashboardViewPinned = trpc.admin.pilot.views.setPinned.useMutation({
    onSuccess: async () => {
      await utils.admin.pilot.views.list.invalidate();
      toast.success("Saved view pin updated.");
    },
    onError: error => toast.error(error.message),
  });

  const reorderPinnedViews = trpc.admin.pilot.views.reorderPinned.useMutation({
    onSuccess: async () => {
      await utils.admin.pilot.views.list.invalidate();
      toast.success("Pinned view order updated.");
    },
    onError: error => toast.error(error.message),
  });
  const renameDashboardViewFolder = trpc.admin.pilot.views.renameFolder.useMutation({
    onSuccess: async (_result, input) => {
      if (folderFilter === input.fromFolder) setFolderFilter(input.toFolder);
      setFolderRenameDraft("");
      await utils.admin.pilot.views.list.invalidate();
      toast.success("Private folder renamed.");
    },
    onError: error => toast.error(error.message),
  });
  const moveDashboardViewsToFolder = trpc.admin.pilot.views.moveToFolder.useMutation({
    onSuccess: async () => {
      setSelectedSavedViewIds([]);
      setBulkFolderDraft("");
      setBulkFolderColorDraft("saffron");
      await utils.admin.pilot.views.list.invalidate();
      toast.success("Selected saved views moved.");
    },
    onError: error => toast.error(error.message),
  });
  const duplicateDashboardView = trpc.admin.pilot.views.duplicate.useMutation({
    onSuccess: async ({ view }) => {
      setSelectedDashboardViewId(view.id);
      setDashboardViewName(view.name);
      setFolderDraft(view.folder ?? "");
      setFolderColorDraft((view.folderColor as FolderColor | null) ?? "saffron");
      await utils.admin.pilot.views.list.invalidate();
      toast.success("Private dashboard view duplicated.");
    },
    onError: error => toast.error(error.message),
  });
  const setDashboardViewArchived = trpc.admin.pilot.views.setArchived.useMutation({
    onSuccess: async (_result, input) => {
      if (input.isArchived && selectedDashboardViewId === input.viewId) {
        setSelectedDashboardViewId(null);
        setDashboardViewName("");
        setFolderDraft("");
        setFolderColorDraft("saffron");
      }
      await utils.admin.pilot.views.list.invalidate();
      toast.success(input.isArchived ? "Saved view archived." : "Saved view restored.");
    },
    onError: error => toast.error(error.message),
  });
  const setDashboardFolderColor = trpc.admin.pilot.views.setFolderColor.useMutation({
    onSuccess: async () => {
      await utils.admin.pilot.views.list.invalidate();
      toast.success("Private folder color updated.");
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
  const monthlyTrend = monthlyTrendQuery.data?.months ?? [];
  const trendScopeLabel = trendCohortType === "college" ? "College cohorts" : trendCohortType === "ngo" ? "NGO cohorts" : "All cohorts combined";
  const funnelSummary = summariseFunnelSegment(conversions);
  const quarterChange = trendPeriod === "quarter" ? getQuarterOverQuarterChange(monthlyTrend) : null;
  const hindiPdfPrintInput = useMemo(() => ({
    filters: { from: reportStartDate, to: reportEndDate, segment: trendCohortType, view: trendPeriod },
    totals: funnelSummary,
    quarterChange,
    header: pdfHeaderDraft,
    footer: pdfFooterDraft,
    logo: pdfLogoDraft,
    customLogoUrl: pdfCustomLogoUrlDraft,
    dateFormat: pdfDateFormatDraft,
  }), [funnelSummary, pdfCustomLogoUrlDraft, pdfDateFormatDraft, pdfFooterDraft, pdfHeaderDraft, pdfLogoDraft, quarterChange, reportEndDate, reportStartDate, trendCohortType, trendPeriod]);
  const hindiPdfPreviewHtml = useMemo(
    () => createHindiPilotDashboardSummaryPrintHtml(hindiPdfPrintInput),
    [hindiPdfPrintInput]
  );
  const savedViews = savedViewsQuery.data?.views ?? [];
  const selectedDashboardView = savedViews.find(item => item.id === selectedDashboardViewId) ?? null;
  const activeSavedViews = useMemo(() => savedViews.filter(view => !view.isArchived), [savedViews]);
  const archivedSavedViews = useMemo(() => savedViews.filter(view => view.isArchived), [savedViews]);
  const scopedSavedViews = savedViewScope === "active" ? activeSavedViews : archivedSavedViews;
  const folderCounts = useMemo(() => activeSavedViews.reduce<Record<string, number>>((counts, view) => {
    if (view.folder) counts[view.folder] = (counts[view.folder] ?? 0) + 1;
    return counts;
  }, {}), [activeSavedViews]);
  const folderColors = useMemo(() => activeSavedViews.reduce<Record<string, FolderColor>>((colors, view) => {
    if (view.folder && view.folderColor && !colors[view.folder]) colors[view.folder] = view.folderColor as FolderColor;
    return colors;
  }, {}), [activeSavedViews]);
  const allFolders = useMemo(() => Object.keys(folderCounts).sort((left, right) => left.localeCompare(right)), [folderCounts]);
  const pinnedViews = useMemo(() => activeSavedViews.filter(view => view.isPinned), [activeSavedViews]);
  const visibleSavedViews = useMemo(() => {
    const normalizedSearch = savedViewSearch.trim().toLocaleLowerCase();
    return scopedSavedViews.filter(view => {
      const searchMatches = !normalizedSearch || view.name.toLocaleLowerCase().includes(normalizedSearch);
      const folderMatches = !folderFilter || view.folder === folderFilter;
      return searchMatches && folderMatches;
    });
  }, [folderFilter, savedViewSearch, scopedSavedViews]);
  useEffect(() => {
    setSelectedSavedViewIds(current => {
      const next = current.filter(viewId => savedViews.some(view => view.id === viewId));
      return next.length === current.length ? current : next;
    });
  }, [savedViews]);
  const exportCohortReport = () => {
    if (!conversions.length) {
      toast.error("There is no cohort data in this date range to export.");
      return;
    }
    const report = createCohortConversionReportCsv(conversions, reportRange, { cohortType: trendCohortType, period: trendPeriod, months: monthlyTrend });
    downloadTextFile(report.contents, report.fileName, "text/csv;charset=utf-8");
    toast.success("Cohort conversion report downloaded.");
  };
  const copyDashboardView = async () => {
    const search = createPilotDashboardSearch({ from: reportStartDate, to: reportEndDate, segment: trendCohortType, view: trendPeriod });
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${search}`);
      toast.success("Dashboard view link copied.");
    } catch {
      toast.error("Copy failed. Please copy the browser address bar URL.");
    }
  };
  const exportDashboardSummary = () => {
    const summary = createPilotDashboardSummary({
      filters: { from: reportStartDate, to: reportEndDate, segment: trendCohortType, view: trendPeriod },
      totals: funnelSummary,
      quarterChange,
      language: summaryLanguage,
    });
    downloadTextFile(summary.contents, summary.fileName, "text/plain;charset=utf-8");
    toast.success(`${summaryLanguage === "hi" ? "Hindi" : "English"} read-only dashboard summary downloaded.`);
  };
  const exportHindiDashboardSummaryPdf = () => {
    const opened = openHindiPilotDashboardSummaryPdf(hindiPdfPrintInput);
    if (opened) toast.success("Hindi dashboard summary is ready in the print dialog. Choose Save as PDF.");
    else toast.error("The PDF print window was blocked. Allow pop-ups and try again.");
  };
  const saveCurrentDashboardView = () => {
    saveDashboardView.mutate({
      name: dashboardViewName,
      filters: { from: reportStartDate, to: reportEndDate, segment: trendCohortType, view: trendPeriod },
      folder: folderDraft.trim() || null,
      folderColor: folderDraft.trim() ? folderColorDraft : null,
    });
  };
  const loadDashboardView = (viewId: number) => {
    const view = savedViews.find(item => item.id === viewId);
    if (!view) return;
    setSelectedDashboardViewId(view.id);
    setDashboardViewName(view.name);
    setFolderDraft(view.folder ?? "");
    setFolderColorDraft((view.folderColor as FolderColor | null) ?? "saffron");
    setReportStartDate(view.filters.from);
    setReportEndDate(view.filters.to);
    setTrendCohortType(view.filters.segment);
    setTrendPeriod(view.filters.view);
  };
  const toggleSavedViewSelection = (viewId: number, checked: boolean) => {
    setSelectedSavedViewIds(current => checked
      ? current.includes(viewId) ? current : [...current, viewId]
      : current.filter(id => id !== viewId)
    );
  };
  const selectVisibleSavedViews = () => {
    setSelectedSavedViewIds(visibleSavedViews.map(view => view.id));
  };
  const loadAdjacentSavedView = (direction: -1 | 1) => {
    if (!visibleSavedViews.length) return;
    const currentIndex = visibleSavedViews.findIndex(view => view.id === selectedDashboardViewId);
    const nextIndex = currentIndex < 0
      ? direction === 1 ? 0 : visibleSavedViews.length - 1
      : (currentIndex + direction + visibleSavedViews.length) % visibleSavedViews.length;
    loadDashboardView(visibleSavedViews[nextIndex].id);
  };
  useEffect(() => {
    const handleSavedViewShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, button, [contenteditable='true']")))
      ) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        loadAdjacentSavedView(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        loadAdjacentSavedView(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const viewId = selectedDashboardViewId ?? visibleSavedViews[0]?.id;
        if (viewId) loadDashboardView(viewId);
      } else if (event.key.toLocaleLowerCase() === "s") {
        event.preventDefault();
        if (dashboardViewName.trim()) saveCurrentDashboardView();
        else toast.error("Give the dashboard view a name before using Alt+S.");
      } else if (event.key.toLocaleLowerCase() === "d") {
        event.preventDefault();
        if (selectedDashboardView) duplicateDashboardView.mutate({ viewId: selectedDashboardView.id });
        else toast.error("Select a saved dashboard view before using Alt+D.");
      }
    };
    window.addEventListener("keydown", handleSavedViewShortcut);
    return () => window.removeEventListener("keydown", handleSavedViewShortcut);
  }, [dashboardViewName, selectedDashboardView, selectedDashboardViewId, visibleSavedViews]);
  const handlePinnedViewDragStart = (event: DragEvent<HTMLLIElement>, viewId: number) => {
    setDraggedViewId(viewId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(viewId));
  };
  const handlePinnedViewDrop = (event: DragEvent<HTMLLIElement>, targetViewId: number) => {
    event.preventDefault();
    const sourceViewId = draggedViewId ?? Number(event.dataTransfer.getData("text/plain"));
    setDraggedViewId(null);
    if (!sourceViewId || sourceViewId === targetViewId || reorderPinnedViews.isPending) return;
    const fromIndex = pinnedViews.findIndex(view => view.id === sourceViewId);
    const toIndex = pinnedViews.findIndex(view => view.id === targetViewId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextOrder = [...pinnedViews];
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);
    reorderPinnedViews.mutate({ viewIds: nextOrder.map(view => view.id) });
  };

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
          <div className="pilot-card-heading"><div><p className="desk-kicker"><BarChart3 size={14} /> CONVERSION FUNNEL</p><h2>See which cohorts become accounts</h2><p>{trendScopeLabel}. Counts are aggregate-only: one anonymised browser visit, feedback submissions, and first account attribution per active cohort link.</p></div><div className="pilot-report-actions"><button type="button" className="pilot-export-report" onClick={copyDashboardView}><Copy size={15} /> Share view</button><label className="pilot-summary-language">Summary language<select value={summaryLanguage} onChange={event => setSummaryLanguage(event.target.value as "en" | "hi")}><option value="en">English</option><option value="hi">हिन्दी</option></select></label><button type="button" className="pilot-export-report" disabled={reportRangeInvalid || conversionQuery.isLoading} onClick={exportDashboardSummary}><Download size={15} /> Export summary</button><button type="button" className="pilot-export-report" disabled={reportRangeInvalid || conversionQuery.isLoading} onClick={() => setPdfPreviewOpen(true)}><Eye size={15} /> Preview PDF</button><button type="button" className="pilot-export-report" disabled={reportRangeInvalid || conversionQuery.isLoading} onClick={exportHindiDashboardSummaryPdf}><Download size={15} /> Hindi PDF</button><button type="button" className="pilot-export-report" disabled={!conversions.length || reportRangeInvalid || conversionQuery.isLoading || monthlyTrendQuery.isLoading} onClick={exportCohortReport}><Download size={15} /> Export CSV report</button></div></div>
          <div className="pilot-report-controls" aria-label="Cohort report date range"><div className="pilot-report-title"><CalendarRange size={17} /><span><strong>Report date range</strong><small>Only funnel events created inside this range are included.</small></span></div><label>From<input type="date" value={reportStartDate} onChange={event => setReportStartDate(event.target.value)} /></label><label>To<input type="date" value={reportEndDate} onChange={event => setReportEndDate(event.target.value)} /></label><button type="button" className="pilot-clear-report" onClick={() => { setReportStartDate(""); setReportEndDate(""); }} disabled={!reportStartDate && !reportEndDate}><RotateCcw size={14} /> All time</button></div>
          <div className="pilot-pdf-customization" aria-label="Hindi PDF print layout"><div><strong>Hindi PDF print layout</strong><small>These private labels appear only in the browser print window. The PDF remains aggregate-only.</small></div><label>Header<input value={pdfHeaderDraft} maxLength={100} onChange={event => setPdfHeaderDraft(event.target.value)} placeholder="Hindi report header" /></label><label>Footer<input value={pdfFooterDraft} maxLength={120} onChange={event => setPdfFooterDraft(event.target.value)} placeholder="Hindi report footer" /></label><label>Logo<select value={pdfLogoDraft} onChange={event => setPdfLogoDraft(event.target.value as typeof pdfLogoDraft)}><option value="schemeSathi">Scheme Sathi</option><option value="janSeva">जन सेवा</option><option value="custom">Custom logo URL</option><option value="none">No logo</option></select></label>{pdfLogoDraft === "custom" && <label>Custom logo URL<input type="url" value={pdfCustomLogoUrlDraft} maxLength={500} onChange={event => setPdfCustomLogoUrlDraft(event.target.value)} placeholder="https://example.org/logo.png" /></label>}<label>Date format<select value={pdfDateFormatDraft} onChange={event => setPdfDateFormatDraft(event.target.value as typeof pdfDateFormatDraft)}><option value="long">20 अगस्त 2026</option><option value="short">20/08/2026</option><option value="iso">2026-08-20</option></select></label></div>
          <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}><DialogContent className="pilot-pdf-preview-dialog" showCloseButton><DialogHeader><DialogTitle>Hindi PDF preview</DialogTitle><DialogDescription>Review the live aggregate-only document layout, logo, header, footer, and date before opening the print dialog.</DialogDescription></DialogHeader><div className="pilot-pdf-preview-frame"><iframe title="Hindi PDF preview" srcDoc={hindiPdfPreviewHtml} sandbox="" /></div><DialogFooter><button type="button" className="pilot-clear-report" onClick={() => setPdfPreviewOpen(false)}>Close preview</button><button type="button" className="pilot-export-report" onClick={exportHindiDashboardSummaryPdf}><Download size={15} /> Open print dialog</button></DialogFooter></DialogContent></Dialog>
          <div className="pilot-saved-view-controls" aria-label="Saved dashboard views">
            <div className="pilot-saved-view-intro"><strong>Saved dashboard views</strong><small>Private to your administrator account. Pin frequently used views, organise them into folders, and drag pins into the order you prefer.</small><span className="pilot-shortcut-guide" aria-label="Saved-view keyboard shortcuts" aria-keyshortcuts="Alt+ArrowDown Alt+ArrowUp Alt+Enter Alt+S Alt+D"><kbd>Alt+↓</kbd> next <kbd>Alt+↑</kbd> previous <kbd>Alt+Enter</kbd> load <kbd>Alt+S</kbd> save <kbd>Alt+D</kbd> duplicate</span></div>
            <div className="pilot-view-scope-toggle" role="group" aria-label="Saved dashboard view archive"><button type="button" className={savedViewScope === "active" ? "active" : ""} aria-pressed={savedViewScope === "active"} onClick={() => setSavedViewScope("active")}>Active ({activeSavedViews.length})</button><button type="button" className={savedViewScope === "archived" ? "active" : ""} aria-pressed={savedViewScope === "archived"} onClick={() => setSavedViewScope("archived")}>Archived ({archivedSavedViews.length})</button></div>
            <div className="pilot-view-filter-row">
              <label>Search views<input value={savedViewSearch} maxLength={60} onChange={event => setSavedViewSearch(event.target.value)} placeholder="Find a saved view" /></label>
              <label className="pilot-folder-filter">Folder<select value={folderFilter} onChange={event => setFolderFilter(event.target.value)}><option value="">All folders</option>{allFolders.map(folder => <option key={folder} value={folder}>{`${folder} (${folderCounts[folder]})`}</option>)}</select></label>
            </div>
            {allFolders.length > 0 && <div className="pilot-folder-overview" aria-label="Saved view counts by folder">{allFolders.map(folder => <button type="button" key={folder} className={`${folderFilter === folder ? "active " : ""}color-${folderColors[folder] ?? "saffron"}`} onClick={() => setFolderFilter(folder)}><span>{folder}</span><strong className="pilot-folder-count-badge">{folderCounts[folder]}</strong></button>)}</div>}
            {allFolders.length > 0 && <div className="pilot-folder-management"><div><strong>Rename or color selected folder</strong><small>{folderFilter ? `Managing private folder “${folderFilter}”.` : "Choose a folder above before changing its name or color."}</small></div><label>New folder name<input value={folderRenameDraft} maxLength={40} onChange={event => setFolderRenameDraft(event.target.value)} placeholder="For example, Spring review" /></label><label className="pilot-folder-color-control"><span><Palette size={13} /> Color</span><select value={folderFilter ? folderColors[folderFilter] ?? "saffron" : "saffron"} disabled={!folderFilter || setDashboardFolderColor.isPending} onChange={event => folderFilter && setDashboardFolderColor.mutate({ folder: folderFilter, folderColor: event.target.value as FolderColor })}>{folderColorOptions.map(color => <option key={color.value} value={color.value}>{color.label}</option>)}</select></label><button type="button" className="pilot-folder-action" disabled={!folderFilter || !folderRenameDraft.trim() || folderRenameDraft.trim() === folderFilter || renameDashboardViewFolder.isPending} onClick={() => renameDashboardViewFolder.mutate({ fromFolder: folderFilter, toFolder: folderRenameDraft })}>Rename folder</button></div>}
            <div className="pilot-view-editor-row">
              <label>Load view<select value={selectedDashboardViewId?.toString() ?? ""} onChange={event => { const id = Number(event.target.value); if (id) loadDashboardView(id); else { setSelectedDashboardViewId(null); setDashboardViewName(""); setFolderDraft(""); setFolderColorDraft("saffron"); } }}><option value="">{visibleSavedViews.length ? "Select a saved view" : "No matching saved views"}</option>{visibleSavedViews.map(view => <option key={view.id} value={view.id}>{`${view.isArchived ? "Archived — " : view.isPinned ? "Pinned — " : ""}${view.name}${view.folder ? ` · ${view.folder}` : ""}`}</option>)}</select></label>
              <label>Name<input value={dashboardViewName} maxLength={60} onChange={event => setDashboardViewName(event.target.value)} placeholder="For example, College Q2" /></label>
              <label>Folder<input value={folderDraft} maxLength={40} onChange={event => setFolderDraft(event.target.value)} placeholder="For example, Launch review" /></label>
              <label className="pilot-view-folder-color">Folder color<select value={folderColorDraft} disabled={!folderDraft.trim()} onChange={event => setFolderColorDraft(event.target.value as FolderColor)}>{folderColorOptions.map(color => <option key={color.value} value={color.value}>{color.label}</option>)}</select></label>
              <button type="button" className="pilot-pin-view" disabled={!selectedDashboardView || selectedDashboardView.isArchived || setDashboardViewPinned.isPending} onClick={() => selectedDashboardView && setDashboardViewPinned.mutate({ viewId: selectedDashboardView.id, isPinned: !selectedDashboardView.isPinned })}><Pin size={14} /> {selectedDashboardView?.isPinned ? "Unpin" : "Pin"}</button>
              <button type="button" className="pilot-save-view" disabled={saveDashboardView.isPending || !dashboardViewName.trim()} onClick={saveCurrentDashboardView}>Save view</button>
              <button type="button" className="pilot-duplicate-view" disabled={!selectedDashboardView || duplicateDashboardView.isPending} onClick={() => selectedDashboardView && duplicateDashboardView.mutate({ viewId: selectedDashboardView.id })}><Copy size={14} /> Duplicate</button>
              <button type="button" className="pilot-archive-view" disabled={!selectedDashboardView || setDashboardViewArchived.isPending} onClick={() => selectedDashboardView && setDashboardViewArchived.mutate({ viewId: selectedDashboardView.id, isArchived: !selectedDashboardView.isArchived })}>{selectedDashboardView?.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}{selectedDashboardView?.isArchived ? " Restore" : " Archive"}</button>
              <button type="button" className="pilot-delete-view" disabled={!selectedDashboardViewId || deleteDashboardView.isPending} onClick={() => selectedDashboardViewId && deleteDashboardView.mutate({ viewId: selectedDashboardViewId })}>Delete</button>
            </div>
            {visibleSavedViews.length > 0 && <div className="pilot-bulk-view-manager" aria-label="Bulk move saved views"><div className="pilot-bulk-heading"><div><strong>Bulk move saved views</strong><small>{selectedSavedViewIds.length ? `${selectedSavedViewIds.length} private view${selectedSavedViewIds.length === 1 ? "" : "s"} selected.` : "Select one or more visible views, then choose a folder."}</small></div><div><button type="button" onClick={selectVisibleSavedViews}>Select shown</button><button type="button" disabled={!selectedSavedViewIds.length} onClick={() => setSelectedSavedViewIds([])}>Clear selection</button></div></div><div className="pilot-bulk-view-list">{visibleSavedViews.map(view => <label key={view.id}><input type="checkbox" checked={selectedSavedViewIds.includes(view.id)} onChange={event => toggleSavedViewSelection(view.id, event.target.checked)} /><span>{view.name}</span>{view.folder && <span className={`pilot-folder-badge color-${view.folderColor ?? "saffron"}`}>{view.folder}</span>}</label>)}</div><div className="pilot-bulk-move-action"><label>Move selected to folder<input value={bulkFolderDraft} maxLength={40} onChange={event => setBulkFolderDraft(event.target.value)} placeholder="Leave blank to clear folder" /></label><label className="pilot-view-folder-color">Color<select value={bulkFolderColorDraft} disabled={!bulkFolderDraft.trim()} onChange={event => setBulkFolderColorDraft(event.target.value as FolderColor)}>{folderColorOptions.map(color => <option key={color.value} value={color.value}>{color.label}</option>)}</select></label><button type="button" className="pilot-folder-action" disabled={!selectedSavedViewIds.length || moveDashboardViewsToFolder.isPending} onClick={() => moveDashboardViewsToFolder.mutate({ viewIds: selectedSavedViewIds, folder: bulkFolderDraft.trim() || null, folderColor: bulkFolderDraft.trim() ? bulkFolderColorDraft : null })}>Move {selectedSavedViewIds.length || ""} view{selectedSavedViewIds.length === 1 ? "" : "s"}</button></div></div>}
            {pinnedViews.length > 1 && savedViewScope === "active" && <div className="pilot-pinned-order" aria-label="Pinned dashboard view order"><div><strong>Pinned order</strong><small>Drag a view to reorder it. This is private to your account.</small></div><ul>{pinnedViews.map(view => <li key={view.id} draggable={!reorderPinnedViews.isPending} className={draggedViewId === view.id ? "dragging" : ""} onDragStart={event => handlePinnedViewDragStart(event, view.id)} onDragEnd={() => setDraggedViewId(null)} onDragOver={event => event.preventDefault()} onDrop={event => handlePinnedViewDrop(event, view.id)}><GripVertical className="pilot-drag-handle" size={17} aria-hidden="true" /><button type="button" onClick={() => loadDashboardView(view.id)}><span>{view.name}</span>{view.folder && <span className={`pilot-folder-badge color-${view.folderColor ?? "saffron"}`}>{view.folder}</span>}</button></li>)}</ul></div>}
          </div>
          {reportRangeInvalid && <p className="pilot-report-error">Choose a start date that is on or before the end date.</p>}
          {conversionQuery.isLoading ? <div className="pilot-empty"><Loader2 className="spin" size={20} /> Loading cohort conversion…</div> : conversions.length ? <div className="pilot-funnel-table-wrap"><table className="pilot-funnel-table"><thead><tr><th>Cohort</th><th>Link visits</th><th>Feedback</th><th>Signed up</th><th>Visit → signup</th><th>Status</th></tr></thead><tbody>{conversions.map(cohort => <tr key={cohort.inviteId}><td><strong>{cohort.cohortName}</strong><small>{cohort.cohortType}</small></td><td>{cohort.linkVisits}</td><td>{cohort.feedbackSubmissions}<small>{cohort.feedbackRate}% of visits</small></td><td>{cohort.accountSignups}</td><td><span className="pilot-conversion-rate">{cohort.signupRate}%</span></td><td><span className={cohort.active ? "pilot-funnel-status active" : "pilot-funnel-status"}>{cohort.active ? "Active" : "Closed"}</span></td></tr>)}</tbody><tfoot><tr className="pilot-funnel-total"><td><strong>Segment total</strong><small>{trendScopeLabel}</small></td><td>{funnelSummary.linkVisits}</td><td>{funnelSummary.feedbackSubmissions}<small>{funnelSummary.feedbackRate}% of visits</small></td><td>{funnelSummary.accountSignups}</td><td><span className="pilot-conversion-rate">{funnelSummary.signupRate}%</span></td><td><span className="pilot-funnel-status active">Aggregate</span></td></tr></tfoot></table></div> : <div className="pilot-empty"><BarChart3 size={24} /><h3>No cohort funnel data yet</h3><p>Create and share a cohort link to begin aggregate conversion measurement. No visitor or account details will appear here.</p></div>}
        </section>

        <section className="pilot-trend-card" aria-label={`${trendPeriod === "month" ? "Monthly" : "Quarterly"} cohort conversion trend`}>
          <div className="pilot-card-heading"><div><p className="desk-kicker"><BarChart3 size={14} /> {trendPeriod === "month" ? "MONTHLY" : "QUARTERLY"} TREND</p><h2>How cohort conversion changes over time</h2><p>{trendScopeLabel}. {trendPeriod === "month" ? "Monthly" : "Quarterly"} rates use events created inside the selected report range and never expose individual visitor, response, or account data.</p>{quarterChange && <div className="pilot-qoq-badges" aria-label="Quarter-over-quarter conversion change"><Tooltip><TooltipTrigger asChild><span className={`pilot-qoq-badge ${pointChangeTone(quarterChange.feedbackPoints)}`}>Feedback {pointChangeLabel(quarterChange.feedbackPoints)}</span></TooltipTrigger><TooltipContent side="top" className="max-w-72">Feedback change equals the current quarter&apos;s feedback conversion rate minus the prior reported quarter&apos;s rate, in percentage points. It is not percentage growth.</TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><span className={`pilot-qoq-badge ${pointChangeTone(quarterChange.signupPoints)}`}>Signup {pointChangeLabel(quarterChange.signupPoints)}</span></TooltipTrigger><TooltipContent side="top" className="max-w-72">Signup change equals the current quarter&apos;s signup conversion rate minus the prior reported quarter&apos;s rate, in percentage points. It is not percentage growth.</TooltipContent></Tooltip><small>vs prior reported quarter</small></div>}</div><div className="pilot-trend-actions"><label className="pilot-trend-filter">Cohort segment<select value={trendCohortType} onChange={event => setTrendCohortType(event.target.value as typeof trendCohortType)}><option value="all">All cohorts</option><option value="college">College cohorts</option><option value="ngo">NGO cohorts</option></select></label><div className="pilot-period-toggle" role="group" aria-label="Trend view"><button type="button" className={trendPeriod === "month" ? "active" : ""} aria-pressed={trendPeriod === "month"} onClick={() => setTrendPeriod("month")}>Monthly</button><button type="button" className={trendPeriod === "quarter" ? "active" : ""} aria-pressed={trendPeriod === "quarter"} onClick={() => setTrendPeriod("quarter")}>Quarterly</button></div></div></div>
          {monthlyTrendQuery.isLoading ? <div className="pilot-empty"><Loader2 className="spin" size={20} /> Loading {trendPeriod === "month" ? "monthly" : "quarterly"} trend…</div> : monthlyTrend.length ? <div className="pilot-trend-chart"><ResponsiveContainer width="100%" height={290}><LineChart data={monthlyTrend} margin={{ top: 12, right: 22, left: -16, bottom: 4 }}><CartesianGrid stroke="#e7e0d5" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tickFormatter={value => trendPeriodLabel(String(value), trendPeriod)} tick={{ fill: "#6d6b65", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis unit="%" domain={[0, 100]} tick={{ fill: "#6d6b65", fontSize: 10 }} axisLine={false} tickLine={false} width={35} /><RechartsTooltip labelFormatter={value => trendPeriodLabel(String(value), trendPeriod)} formatter={(value: unknown) => `${Array.isArray(value) ? value.join("–") : String(value ?? 0)}%`} contentStyle={{ border: "1px solid #d8d0c3", borderRadius: 0, fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} /><Line type="monotone" dataKey="feedbackRate" name="Visit → feedback" stroke="#19845e" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} /><Line type="monotone" dataKey="signupRate" name="Visit → signup" stroke="#c66a21" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div> : <div className="pilot-empty"><BarChart3 size={24} /><h3>No {trendPeriod === "month" ? "monthly" : "quarterly"} trend yet</h3><p>Share a cohort link and collect activity in a calendar {trendPeriod === "month" ? "month" : "quarter"} to view aggregate conversion rates here.</p></div>}
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
