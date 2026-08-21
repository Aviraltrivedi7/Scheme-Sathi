import type { Scheme } from "@/lib/schemes";

const escapeCsvCell = (value: string) => {
  const normalized = value.replace(/\r\n|\r|\n/g, " ");
  const formulaSafe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
};

const localizedLevel = (level: Scheme["level"], language: "en" | "hi") => language === "hi" ? (level === "Central" ? "केंद्रीय" : "राज्य") : level;

export function createOfflineSavedDeadlineCalendarCsv({ schemes, month, language }: { schemes: Scheme[]; month: Date; language: "en" | "hi" }) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
  const locale = language === "hi" ? "hi-IN" : "en-IN";
  const headers = language === "hi" ? ["योजना", "समयसीमा (ISO)", "समयसीमा", "श्रेणी", "स्तर", "आधिकारिक पोर्टल"] : ["Scheme", "Deadline (ISO)", "Deadline", "Category", "Level", "Official portal"];
  const rows = schemes.filter(scheme => scheme.applicationDeadline && scheme.applicationDeadline >= start && scheme.applicationDeadline < end).sort((left, right) => (left.applicationDeadline ?? 0) - (right.applicationDeadline ?? 0)).map(scheme => {
    const deadline = new Date(scheme.applicationDeadline!);
    return [language === "hi" ? scheme.nameHindi : scheme.name, deadline.toISOString().slice(0, 10), new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(deadline), language === "hi" ? scheme.categoryHindi : scheme.category, localizedLevel(scheme.level, language), scheme.portalUrl];
  });
  return [headers, ...rows].map(row => row.map(escapeCsvCell).join(",")).join("\r\n").concat("\r\n");
}
