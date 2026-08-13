export function clampPdfPage(pageNumber: number, pageCount: number) {
  if (!Number.isFinite(pageCount) || pageCount < 1) return 1;
  return Math.max(1, Math.min(Math.trunc(pageNumber), Math.trunc(pageCount)));
}

export function clampPdfZoom(zoom: number) { return Math.max(0.7, Math.min(2, Math.round(zoom * 100) / 100)); }
export function nextPdfRotation(rotation: number) { return ((rotation + 90) % 360 + 360) % 360; }

export type PdfTextSearchPage = { pageNumber: number; text: string };
export type PdfTextGeometry = { str?: string; transform?: number[]; width?: number; height?: number };
export type PdfHighlightRect = { left: number; top: number; width: number; height: number };

export function findPdfTextMatches(pages: PdfTextSearchPage[], query: string, maxPages = 40) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return pages.slice(0, maxPages).flatMap((page) => { const text = page.text.toLocaleLowerCase(); let from = 0; let count = 0; while (true) { const index = text.indexOf(normalized, from); if (index < 0) break; count += 1; from = index + normalized.length; } return count ? [{ pageNumber: page.pageNumber, count }] : []; });
}

export function findPdfHighlightRects(items: PdfTextGeometry[], query: string, pageWidth: number, pageHeight: number) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized || pageWidth <= 0 || pageHeight <= 0) return [];
  return items.flatMap((item) => { const text = item.str?.toLocaleLowerCase() ?? ""; const transform = item.transform; if (!text.includes(normalized) || !transform) return []; const itemWidth = Math.max(4, item.width ?? Math.abs(transform[0]) ?? 4); const itemHeight = Math.max(6, item.height ?? Math.abs(transform[3]) ?? 8); return [{ left: Math.max(0, Math.min(100, (transform[4] / pageWidth) * 100)), top: Math.max(0, Math.min(100, ((pageHeight - transform[5] - itemHeight) / pageHeight) * 100)), width: Math.max(1, Math.min(100, (itemWidth / pageWidth) * 100)), height: Math.max(1, Math.min(100, (itemHeight / pageHeight) * 100)) }]; });
}
