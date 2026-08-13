export function clampPdfPage(pageNumber: number, pageCount: number) {
  if (!Number.isFinite(pageCount) || pageCount < 1) return 1;
  return Math.max(1, Math.min(Math.trunc(pageNumber), Math.trunc(pageCount)));
}
