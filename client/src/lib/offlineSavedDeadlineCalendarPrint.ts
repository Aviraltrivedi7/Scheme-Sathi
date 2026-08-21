import type { Scheme } from "@/lib/schemes";

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

export function createOfflineSavedDeadlineCalendarPrintHtml({ schemes, month, language, categoryLabel }: { schemes: Scheme[]; month: Date; language: "en" | "hi"; categoryLabel: string }) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
  const locale = language === "hi" ? "hi-IN" : "en-IN";
  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);
  const rows = schemes.filter(scheme => scheme.applicationDeadline && scheme.applicationDeadline >= start && scheme.applicationDeadline < end).sort((left, right) => (left.applicationDeadline ?? 0) - (right.applicationDeadline ?? 0)).map(scheme => `<tr><td>${escapeHtml(language === "hi" ? scheme.nameHindi : scheme.name)}</td><td>${new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(scheme.applicationDeadline!))}</td><td>${escapeHtml(language === "hi" ? scheme.categoryHindi : scheme.category)}</td></tr>`).join("");
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>Scheme Sathi — ${escapeHtml(title)}</title><style>@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#15233e}h1{font-family:Georgia,serif;font-size:27px;margin:0 0 5px}.kicker{color:#a85d12;font-size:10px;font-weight:700;letter-spacing:.08em}.meta{color:#5a6474;font-size:12px;margin:6px 0 20px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #ddd4c5;padding:10px 8px;text-align:left}th{background:#fff4e3;color:#8a5115}.empty{padding:22px;border:1px dashed #c9b691;color:#596171}@media print{body{print-color-adjust:exact}}</style></head><body><p class="kicker">SCHEME SATHI · SAVED DEADLINES</p><h1>${escapeHtml(title)}</h1><p class="meta">${escapeHtml(categoryLabel)} · ${schemes.length} saved scheme${schemes.length === 1 ? "" : "s"}</p>${rows ? `<table><thead><tr><th>Scheme</th><th>Deadline</th><th>Category</th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="empty">No saved deadlines in this month for the selected category.</p>`}</body></html>`;
}
