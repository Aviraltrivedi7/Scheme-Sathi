export function clampPdfPage(pageNumber: number, pageCount: number) {
  if (!Number.isFinite(pageCount) || pageCount < 1) return 1;
  return Math.max(1, Math.min(Math.trunc(pageNumber), Math.trunc(pageCount)));
}

export function clampPdfZoom(zoom: number) { return Math.max(0.7, Math.min(2, Math.round(zoom * 100) / 100)); }
export function nextPdfRotation(rotation: number) { return ((rotation + 90) % 360 + 360) % 360; }
