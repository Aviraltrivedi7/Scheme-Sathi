import { FileText, ImageOff, Loader2 } from "lucide-react";
import { thumbnailFeedback } from "@/lib/verificationHistory";
import { useEffect, useState } from "react";
import "./DocumentThumbnail.css";

type ThumbnailState = { status: "loading" | "ready" | "unavailable"; src?: string };
type PdfLoadingTask = { promise: Promise<{ getPage(pageNumber: number): Promise<{ getViewport(options: { scale: number }): { width: number; height: number }; render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> } }>; destroy(): Promise<void> }>; destroy?: () => Promise<void> | void };
const pdfThumbnailCache = new Map<string, string>();

export function DocumentThumbnail({ url, mimeType, fileName, className = "" }: { url: string; mimeType: string; fileName: string; className?: string }) {
  const [state, setState] = useState<ThumbnailState>(() => mimeType === "application/pdf" ? { status: "loading" } : { status: "ready", src: url });

  useEffect(() => {
    if (mimeType !== "application/pdf") { setState({ status: "ready", src: url }); return; }
    const cached = pdfThumbnailCache.get(url);
    if (cached) { setState({ status: "ready", src: cached }); return; }
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
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.34 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width)); canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas preview is unavailable");
        await page.render({ canvasContext: context, viewport }).promise;
        const src = canvas.toDataURL("image/jpeg", 0.78);
        pdfThumbnailCache.set(url, src);
        if (active) setState({ status: "ready", src });
        await pdf.destroy();
      } catch {
        if (active) setState({ status: "unavailable" });
      }
    })();
    return () => { active = false; void loadingTask?.destroy?.(); };
  }, [mimeType, url]);

  if (state.status === "loading") return <div className={`document-thumbnail loading ${className}`}><Loader2 className="spin" size={16} /><span>{thumbnailFeedback("loading")}</span></div>;
  if (state.status === "unavailable") return <div className={`document-thumbnail unavailable ${className}`}><ImageOff size={17} /><span>{thumbnailFeedback("unavailable")}</span></div>;
  return <img className={`document-thumbnail image ${className}`} src={state.src} alt={`First-page thumbnail of ${fileName}`} />;
}

export function DocumentThumbnailPlaceholder() { return <div className="document-thumbnail unavailable"><FileText size={17} /><span>Document preview</span></div>; }
