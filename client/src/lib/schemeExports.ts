import type { Scheme } from "@/lib/schemes";

export type ExportLanguage = "en" | "hi";
export type ComparableScheme = Scheme & { score: number; factors: string[] };
export const comparisonExportFields = [
  "matchScore",
  "benefit",
  "eligibility",
  "documents",
  "steps",
  "officialPortal",
] as const;
export type ComparisonExportField = (typeof comparisonExportFields)[number];

const text = (language: ExportLanguage, english: string, hindi: string) =>
  language === "hi" ? hindi : english;

function safeFilePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "scheme"
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatIcsUtc(timestamp: number) {
  const date = new Date(timestamp);
  const part = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${part(date.getUTCMonth() + 1)}${part(date.getUTCDate())}T${part(date.getUTCHours())}${part(date.getUTCMinutes())}${part(date.getUTCSeconds())}Z`;
}

export function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string) {
  const characters = Array.from(line);
  if (characters.length <= 73) return line;
  const chunks: string[] = [];
  for (let index = 0; index < characters.length; index += 72)
    chunks.push(characters.slice(index, index + 72).join(""));
  return chunks.join("\r\n ");
}

export function createDeadlineCalendarIcs(
  scheme: Scheme,
  language: ExportLanguage,
  now = Date.now()
) {
  const deadline = scheme.applicationDeadline;
  if (!deadline || deadline <= now) return null;
  const startAt = Math.max(now, deadline - 30 * 60 * 1000);
  const summary = text(
    language,
    `Scheme Sathi deadline: ${scheme.name}`,
    `Scheme Sathi समयसीमा: ${scheme.nameHindi}`
  );
  const deadlineLabel =
    scheme.deadlineLabel ??
    text(language, "Application deadline", "आवेदन समयसीमा");
  const description = text(
    language,
    `${deadlineLabel}. Confirm the current application details on the official portal before applying.`,
    `${deadlineLabel}। आवेदन से पहले आधिकारिक पोर्टल पर वर्तमान विवरण की पुष्टि करें।`
  );
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Scheme Sathi//Civic Discovery//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${safeFilePart(scheme.id)}-${deadline}@scheme-sathi.local`,
    `DTSTAMP:${formatIcsUtc(now)}`,
    `DTSTART:${formatIcsUtc(startAt)}`,
    `DTEND:${formatIcsUtc(deadline)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${scheme.portalUrl}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return {
    fileName: `scheme-sathi-${safeFilePart(scheme.id)}-deadline.ics`,
    contents: lines.map(foldIcsLine).join("\r\n").concat("\r\n"),
  };
}

export function escapeComparisonCsvCell(value: string) {
  const normalized = value.replace(/\r\n|\r|\n/g, " ");
  const formulaSafe = /^[=+\-@]/.test(normalized)
    ? `'${normalized}`
    : normalized;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

function keyEligibility(scheme: Scheme, language: ExportLanguage) {
  return [
    scheme.eligibility.age_min !== undefined
      ? `${text(language, "Age", "आयु")}: ${scheme.eligibility.age_min}${scheme.eligibility.age_max ? `–${scheme.eligibility.age_max}` : "+"}`
      : null,
    scheme.eligibility.income_max
      ? `${text(language, "Income up to", "आय सीमा")}: ₹${scheme.eligibility.income_max.toLocaleString("en-IN")}`
      : null,
    scheme.eligibility.states !== "all" && scheme.eligibility.states
      ? scheme.eligibility.states.join(", ")
      : text(language, "All India", "पूरे भारत में"),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function comparisonExportFieldLabel(
  field: ComparisonExportField,
  language: ExportLanguage
) {
  const labels: Record<ComparisonExportField, [string, string]> = {
    matchScore: ["Match score", "मिलान स्कोर"],
    benefit: ["Benefit", "लाभ"],
    eligibility: ["Key eligibility", "मुख्य पात्रता"],
    documents: ["Documents", "दस्तावेज़"],
    steps: ["Application steps", "आवेदन के चरण"],
    officialPortal: ["Official portal", "आधिकारिक पोर्टल"],
  };
  return text(language, ...labels[field]);
}

export function comparisonRows(
  schemes: ComparableScheme[],
  language: ExportLanguage,
  fields: readonly ComparisonExportField[] = comparisonExportFields
) {
  const rows = [
    {
      id: "matchScore" as const,
      label: text(language, "Match score", "मिलान स्कोर"),
      values: schemes.map(scheme => `${scheme.score}/100`),
    },
    {
      id: "benefit" as const,
      label: text(language, "Benefit", "लाभ"),
      values: schemes.map(scheme =>
        text(language, scheme.benefits, scheme.benefitsHindi)
      ),
    },
    {
      id: "eligibility" as const,
      label: text(language, "Key eligibility", "मुख्य पात्रता"),
      values: schemes.map(scheme => keyEligibility(scheme, language)),
    },
    {
      id: "documents" as const,
      label: text(language, "Documents", "दस्तावेज़"),
      values: schemes.map(scheme =>
        (language === "hi" ? scheme.documentsHindi : scheme.documents).join(
          " · "
        )
      ),
    },
    {
      id: "steps" as const,
      label: text(language, "Application steps", "आवेदन के चरण"),
      values: schemes.map(scheme =>
        (language === "hi" ? scheme.stepsHindi : scheme.steps)
          .map((step, index) => `${index + 1}. ${step}`)
          .join(" | ")
      ),
    },
    {
      id: "officialPortal" as const,
      label: text(language, "Official portal", "आधिकारिक पोर्टल"),
      values: schemes.map(scheme => scheme.portalUrl),
    },
  ];
  const selected = new Set(fields.length ? fields : comparisonExportFields);
  return rows.filter(row => selected.has(row.id));
}

export function createComparisonCsv(
  schemes: ComparableScheme[],
  language: ExportLanguage,
  fields: readonly ComparisonExportField[] = comparisonExportFields
) {
  const header = [
    text(language, "Comparison point", "तुलना का बिंदु"),
    ...schemes.map(scheme => text(language, scheme.name, scheme.nameHindi)),
  ];
  const rows = comparisonRows(schemes, language, fields).map(row => [
    row.label,
    ...row.values,
  ]);
  return [header, ...rows]
    .map(row => row.map(escapeComparisonCsvCell).join(","))
    .join("\r\n")
    .concat("\r\n");
}

export function createComparisonPrintHtml(
  schemes: ComparableScheme[],
  language: ExportLanguage,
  generatedAt = new Date(),
  fields: readonly ComparisonExportField[] = comparisonExportFields
) {
  const heading = text(language, "Scheme comparison", "योजना तुलना");
  const subtitle = text(
    language,
    "Generated by Scheme Sathi. Verify current details on each official portal before applying.",
    "Scheme Sathi द्वारा तैयार। आवेदन से पहले हर आधिकारिक पोर्टल पर वर्तमान विवरण की पुष्टि करें।"
  );
  const header = schemes
    .map(
      scheme =>
        `<th>${escapeHtml(text(language, scheme.name, scheme.nameHindi))}</th>`
    )
    .join("");
  const body = comparisonRows(schemes, language, fields)
    .map(
      row =>
        `<tr><th>${escapeHtml(row.label)}</th>${row.values.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`
    )
    .join("");
  return `<!doctype html><html lang="${language === "hi" ? "hi-IN" : "en-IN"}"><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title><style>@page { size: A4 landscape; margin: 13mm; } body { color: #18233d; font: 12px Arial, sans-serif; } h1 { font-family: Georgia, serif; margin: 0 0 4px; } p { color: #4e5668; margin: 0 0 18px; } table { width: 100%; border-collapse: collapse; table-layout: fixed; } th, td { border: 1px solid #d9d1c4; padding: 9px; vertical-align: top; text-align: left; overflow-wrap: anywhere; } thead th { background: #f2e6d4; } tbody th { background: #fbf7f0; width: 17%; } footer { color: #747a86; font-size: 10px; margin-top: 12px; }</style></head><body><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(subtitle)}</p><table><thead><tr><th>${escapeHtml(text(language, "Comparison point", "तुलना का बिंदु"))}</th>${header}</tr></thead><tbody>${body}</tbody></table><footer>${escapeHtml(generatedAt.toLocaleString("en-IN"))}</footer></body></html>`;
}

export function downloadTextFile(
  contents: string,
  fileName: string,
  mimeType: string
) {
  const blob = new Blob([contents], { type: mimeType });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function openComparisonPdfDialog(
  schemes: ComparableScheme[],
  language: ExportLanguage,
  fields: readonly ComparisonExportField[] = comparisonExportFields
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(
    createComparisonPrintHtml(schemes, language, new Date(), fields)
  );
  printWindow.document.close();
  window.setTimeout(() => printWindow.print(), 240);
  return true;
}
