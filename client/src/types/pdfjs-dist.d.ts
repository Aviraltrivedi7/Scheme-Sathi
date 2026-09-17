declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(source: { url: string; isEvalSupported?: boolean }): {
    promise: Promise<{
      getPage(pageNumber: number): Promise<{
        getViewport(options: { scale: number }): { width: number; height: number };
        render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
      }>;
      destroy(): Promise<void>;
    }>;
    destroy(): Promise<void>;
  };
}
