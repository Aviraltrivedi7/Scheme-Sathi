import { FileText, ImageOff, Loader2 } from "lucide-react";
import { thumbnailFeedback } from "@/lib/verificationHistory";
import { clampPdfPage, clampPdfZoom, nextPdfRotation } from "@/lib/pdfPreview";
import { useEffect, useState } from "react";
import "./DocumentThumbnail.css";

type ThumbnailState = { status: "loading" | "ready" | "unavailable"; src?: string; pageCount?: number; renderedPage?: number };
type PdfLoadingTask = { promise: Promise<{ numPages: number; getPage(pageNumber: number): Promise<{ getViewport(options: { scale: number }): { width: number; height: number }; render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> } }>; destroy(): Promise<void> }>; destroy?: () => Promise<void> | void };
const pdfThumbnailCache = new Map<string, string>();

export function DocumentThumbnail({ url, mimeType, fileName, className = "", scale = 0.34, showNavigation = scale >= 0.7 }: { url: string; mimeType: string; fileName: string; className?: string; scale?: number; showNavigation?: boolean }) {
  const [state, setState] = useState<ThumbnailState>(() => mimeType === "application/pdf" ? { status: "loading" } : { status: "ready", src: url });
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const renderScale = scale * zoom;

  useEffect(() => { setPageNumber(1); setZoom(1); setRotation(0); }, [url]);

  useEffect(() => {
    if (mimeType !== "application/pdf") { setState({ status: "ready", src: url }); return; }
    const cacheKey = `${url}:${renderScale}:${pageNumber}`;
    const cached = pdfThumbnailCache.get(cacheKey);
    if (cached) { setState((current) => ({ status: "ready", src: cached, pageCount: current.pageCount, renderedPage: pageNumber })); return; }
    let active = true;
    let loadingTask: PdfLoadingTask | undefined;
    setState({ status: "loading" });
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const task = pdfjs.getDocument({ url, isEvalSupported: false }) as PdfLoadingTask;
        loadingTask = task;
        const pdf = await task.promise;
        const renderedPage = clampPdfPage(pageNumber, pdf.numPages);
        const page = await pdf.getPage(renderedPage);
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width)); canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas preview is unavailable");
        await page.render({ canvasContext: context, viewport }).promise;
        const src = canvas.toDataURL("image/jpeg", 0.78);
        pdfThumbnailCache.set(cacheKey, src);
        if (active) setState({ status: "ready", src, pageCount: pdf.numPages, renderedPage });
        await pdf.destroy();
      } catch {
        if (active) setState({ status: "unavailable" });
      }
    })();
    return () => { active = false; void loadingTask?.destroy?.(); };
  }, [mimeType, pageNumber, renderScale, url]);

  if (state.status === "loading") return <div className={`document-thumbnail loading ${className}`}><Loader2 className="spin" size={16} /><span>{thumbnailFeedback("loading")}</span></div>;
  if (state.status === "unavailable") return <div className={`document-thumbnail unavailable ${className}`}><ImageOff size={17} /><span>{thumbnailFeedback("unavailable")}</span></div>;
  const image = <img className="document-thumbnail image" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} src={state.src} alt={`Page ${state.renderedPage ?? 1} preview of ${fileName}`} />;
  if (!showNavigation || mimeType !== "application/pdf" || !state.pageCount) return <span className={className}>{image}</span>;
  const page = state.renderedPage ?? pageNumber;
  return <div className={`document-thumbnail-paged ${className}`}>{image}<nav aria-label="PDF page navigation"><button type="button" disabled={page <= 1} onClick={() => setPageNumber((current) => clampPdfPage(current - 1, state.pageCount ?? 1))}>Previous</button><span>Page {page} of {state.pageCount}</span><button type="button" disabled={page >= state.pageCount} onClick={() => setPageNumber((current) => clampPdfPage(current + 1, state.pageCount ?? 1))}>Next</button></nav><div className="document-preview-transforms" aria-label="PDF readability controls"><button type="button" disabled={zoom <= 0.7} onClick={() => setZoom((current) => clampPdfZoom(current - 0.15))}>− Zoom</button><span>{Math.round(zoom * 100)}%</span><button type="button" disabled={zoom >= 2} onClick={() => setZoom((current) => clampPdfZoom(current + 0.15))}>+ Zoom</button><button type="button" onClick={() => setRotation(nextPdfRotation)}>Rotate</button><button type="button" disabled={zoom === 1 && rotation === 0} onClick={() => { setZoom(1); setRotation(0); }}>Reset</button></div></div>;
}

export function DocumentThumbnailPlaceholder() { return <div className="document-thumbnail unavailable"><FileText size={17} /><span>Document preview</span></div>; }
