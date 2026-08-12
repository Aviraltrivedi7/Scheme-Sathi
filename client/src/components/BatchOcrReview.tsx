import { trpc } from "@/lib/trpc";
import { Progress } from "@/components/ui/progress";
import { batchOcrPercent, batchOcrSummary, createBatchOcrProgress, finishBatchOcrItem, startBatchOcrItem, type BatchOcrProgress } from "@/lib/batchOcrProgress";
import { BadgeCheck, CheckSquare, CircleCheck, CircleX, Loader2, ScanText, ShieldCheck, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function BatchOcrReview() {
  const utils = trpc.useUtils();
  const applications = trpc.applications.list.useQuery();
  const [selected, setSelected] = useState<number[]>([]);
  const [ocrProgress, setOcrProgress] = useState<BatchOcrProgress | null>(null);
  const documents = useMemo(() => (applications.data?.applications ?? []).flatMap((application) => (application.documents ?? []).map((document) => ({ ...document, schemeName: application.scheme?.name ?? application.schemeId }))), [applications.data]);
  const select = (documentId: number) => setSelected((current) => current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId]);
  const extractDocument = trpc.documents.extract.useMutation();
  const batchApprove = trpc.documents.batchApproveOcr.useMutation({ onSuccess: async ({ outcomes }) => { await utils.applications.list.invalidate(); const failed = outcomes.filter((outcome) => !outcome.ok).length; toast.success(`${outcomes.length - failed} document${outcomes.length - failed === 1 ? "" : "s"} approved${failed ? `; ${failed} still need review.` : "."}`); }, onError: () => toast.error("Batch approval could not be completed.") });
  const extractable = selected.filter((id) => documents.find((document) => document.id === id)?.ocrStatus !== "processing");
  const approvable = selected.filter((id) => { const document = documents.find((candidate) => candidate.id === id); return document?.ocrStatus === "complete" && !document.userVerifiedAt; });
  const isExtracting = Boolean(ocrProgress && ocrProgress.completed < ocrProgress.total);
  const runBatchExtraction = async () => {
    const batch = extractable.slice(0, 5).map((documentId) => ({ documentId, documentName: documents.find((document) => document.id === documentId)?.documentName ?? "Selected document" }));
    if (!batch.length) return;
    let progress = createBatchOcrProgress(batch); setOcrProgress(progress);
    for (const item of batch) { progress = startBatchOcrItem(progress, item); setOcrProgress(progress); try { await extractDocument.mutateAsync({ documentId: item.documentId }); progress = finishBatchOcrItem(progress, item.documentId, true); } catch (error) { progress = finishBatchOcrItem(progress, item.documentId, false, error instanceof Error ? error.message : undefined); } setOcrProgress(progress); }
    await utils.applications.list.invalidate();
    toast.success(batchOcrSummary(progress));
  };

  if (!documents.length) return null;
  return <section className="batch-ocr-review"><div className="batch-heading"><div><span className="desk-kicker"><CheckSquare size={14} /> BATCH REVIEW</span><h2>Review several documents, carefully.</h2><p>Select up to 5 files for OCR at once. Batch approval only confirms completed OCR results; you remain responsible for checking each preview.</p></div><span>{selected.length} selected</span></div>{ocrProgress && <div className="batch-progress" aria-live="polite"><div><span>{batchOcrSummary(ocrProgress)}</span><strong>{batchOcrPercent(ocrProgress)}%</strong></div><Progress value={batchOcrPercent(ocrProgress)} /><small>{ocrProgress.runningDocumentId ? ocrProgress.items[ocrProgress.runningDocumentId]?.message : ocrProgress.completed === ocrProgress.total ? "Batch extraction finished. Review each completed result before approval." : "Preparing secure document previews for OCR…"}</small></div>}<div className="batch-document-list">{documents.map((document) => { const local = ocrProgress?.items[document.id]; const label = local?.state === "running" ? "Extracting" : local?.state === "complete" ? "Extracted — review" : local?.state === "failed" ? "Needs retry" : document.userVerifiedAt ? "Verified" : document.ocrStatus === "complete" ? "Ready to review" : document.ocrStatus === "failed" ? "Needs retry" : document.ocrStatus === "processing" ? "Extracting" : "OCR pending"; return <label className={selected.includes(document.id) ? "selected" : ""} key={document.id}><button type="button" disabled={isExtracting} onClick={() => select(document.id)} aria-pressed={selected.includes(document.id)}>{selected.includes(document.id) ? <CheckSquare size={17} /> : <Square size={17} />}</button><div><strong>{document.documentName}</strong><small>{document.fileName} · {document.schemeName}</small>{local && <small className={`batch-progress-detail ${local.state}`}>{local.state === "complete" ? <CircleCheck size={12} /> : local.state === "failed" ? <CircleX size={12} /> : local.state === "running" ? <Loader2 className="spin" size={12} /> : null}{local.message}</small>}</div><span className={`batch-doc-status ${local?.state ?? document.ocrStatus}`}>{label}</span></label>; })}</div><div className="batch-actions"><div><ShieldCheck size={15} /><span>Batch actions preserve per-document results. Unsuccessful files remain available for individual retry.</span></div><button className="desk-outline" disabled={!extractable.length || extractable.length > 5 || isExtracting} onClick={runBatchExtraction}>{isExtracting ? <Loader2 className="spin" size={15} /> : <ScanText size={15} />}{isExtracting ? `Extracting ${ocrProgress!.completed + 1} / ${ocrProgress!.total}` : `Run OCR for ${extractable.length || "selected"}`}</button><button className="desk-primary" disabled={!approvable.length || batchApprove.isPending || isExtracting} onClick={() => batchApprove.mutate({ documentIds: approvable })}>{batchApprove.isPending ? <Loader2 className="spin" size={15} /> : <BadgeCheck size={15} />} Approve {approvable.length || "selected"}</button></div>{extractable.length > 5 && <small className="batch-limit">Select no more than 5 documents for one OCR batch.</small>}</section>;
}
