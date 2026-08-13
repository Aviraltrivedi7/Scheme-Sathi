export function clampPdfPage(pageNumber: number, pageCount: number) {
  if (!Number.isFinite(pageCount) || pageCount < 1) return 1;
  return Math.max(1, Math.min(Math.trunc(pageNumber), Math.trunc(pageCount)));
}

export function clampPdfZoom(zoom: number) { return Math.max(0.7, Math.min(2, Math.round(zoom * 100) / 100)); }
export function nextPdfRotation(rotation: number) { return ((rotation + 90) % 360 + 360) % 360; }

export type PdfTextSearchPage = { pageNumber: number; text: string };
export function findPdfTextMatches(pages: PdfTextSearchPage[], query: string, maxPages = 40) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return pages.slice(0, maxPages).flatMap((page) => { const text = page.text.toLocaleLowerCase(); let from = 0; let count = 0; while (true) { const index = text.indexOf(normalized, from); if (index < 0) break; count += 1; from = index + normalized.length; } return count ? [{ pageNumber: page.pageNumber, count }] : []; });
}
