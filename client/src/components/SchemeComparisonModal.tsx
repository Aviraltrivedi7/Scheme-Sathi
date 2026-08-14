import { Check, ExternalLink, FileDown, FileSpreadsheet, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import type { Scheme } from "@/lib/schemes";
import { comparisonExportFieldLabel, comparisonExportFields, createComparisonCsv, downloadTextFile, openComparisonPdfDialog, type ComparisonExportField } from "@/lib/schemeExports";

type Language = "en" | "hi";
const text = (language: Language, english: string, hindi: string) =>
  language === "hi" ? hindi : english;
export function SchemeComparisonModal({
  schemes,
  language,
  onClose,
  onRemove,
}: {
  schemes: (Scheme & { score: number; factors: string[] })[];
  language: Language;
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const [selectedExportFields, setSelectedExportFields] = useState<ComparisonExportField[]>([...comparisonExportFields]);
  const rows = [
    {
      label: text(language, "Match score", "मिलान स्कोर"),
      value: (scheme: Scheme & { score: number }) => `${scheme.score}/100`,
    },
    {
      label: text(language, "Benefit", "लाभ"),
      value: (scheme: Scheme) =>
        text(language, scheme.benefits, scheme.benefitsHindi),
    },
    {
      label: text(language, "Key eligibility", "मुख्य पात्रता"),
      value: (scheme: Scheme) =>
        [
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
          .join(" · "),
    },
    {
      label: text(language, "Documents", "दस्तावेज़"),
      value: (scheme: Scheme) =>
        (language === "hi" ? scheme.documentsHindi : scheme.documents).join(
          " · "
        ),
    },
    {
      label: text(language, "Application steps", "आवेदन के चरण"),
      value: (scheme: Scheme) =>
        (language === "hi" ? scheme.stepsHindi : scheme.steps)
          .map((step, index) => `${index + 1}. ${step}`)
          .join("\n"),
    },
  ];
  const exportCsv = () => {
    downloadTextFile(createComparisonCsv(schemes, language, selectedExportFields), "scheme-sathi-comparison.csv", "text/csv;charset=utf-8");
    toast.success(text(language, "Comparison exported as CSV.", "तुलना CSV के रूप में डाउनलोड हो गई है।"));
  };
  const exportPdf = () => {
    if (!openComparisonPdfDialog(schemes, language, selectedExportFields)) {
      toast.error(text(language, "Your browser blocked the PDF dialog. Allow pop-ups and try again.", "आपके ब्राउज़र ने PDF डायलॉग रोक दिया। पॉप-अप की अनुमति देकर फिर कोशिश करें।"));
      return;
    }
    toast.message(text(language, "Choose “Save as PDF” in the print dialog.", "प्रिंट डायलॉग में “Save as PDF” चुनें।"));
  };
  const toggleExportField = (field: ComparisonExportField) => {
    setSelectedExportFields(current => {
      if (current.includes(field)) {
        if (current.length === 1) {
          toast.message(text(language, "Keep at least one field in your export.", "एक्सपोर्ट में कम-से-कम एक फ़ील्ड रखें।"));
          return current;
        }
        return current.filter(item => item !== field);
      }
      return [...current, field];
    });
  };
  return (
    <div className="comparison-backdrop" role="presentation" onClick={onClose}>
      <section
        className="comparison-modal"
        role="dialog"
        aria-modal="true"
        aria-label={text(language, "Compare schemes", "योजनाओं की तुलना")}
        onClick={event => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="section-kicker">
              {text(language, "Side-by-side", "साथ-साथ")}
            </span>
            <h2>
              {text(
                language,
                "Compare your selected schemes",
                "चुनी हुई योजनाओं की तुलना करें"
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={text(language, "Close comparison", "तुलना बंद करें")}
          >
            <X size={20} />
          </button>
        </header>
        <div className="comparison-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{text(language, "What to compare", "तुलना का बिंदु")}</th>
                {schemes.map(scheme => (
                  <th key={scheme.id}>
                    <button
                      onClick={() => onRemove(scheme.id)}
                      aria-label={text(
                        language,
                        `Remove ${scheme.name} from comparison`,
                        `${scheme.nameHindi} को तुलना से हटाएँ`
                      )}
                    >
                      <X size={13} />
                    </button>
                    <strong>
                      {text(language, scheme.name, scheme.nameHindi)}
                    </strong>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  {schemes.map(scheme => (
                    <td key={scheme.id}>{row.value(scheme)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th>{text(language, "Official portal", "आधिकारिक पोर्टल")}</th>
                {schemes.map(scheme => (
                  <td key={scheme.id}>
                    <a href={scheme.portalUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={13} />
                      {text(language, "Open portal", "पोर्टल खोलें")}
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <section className="comparison-export-field-picker" aria-labelledby="comparison-export-fields-title">
          <div>
            <span className="section-kicker">{text(language, "Export details", "एक्सपोर्ट विवरण")}</span>
            <h3 id="comparison-export-fields-title">{text(language, "Choose fields for CSV or PDF", "CSV या PDF के लिए फ़ील्ड चुनें")}</h3>
          </div>
          <div className="comparison-field-options">
            {comparisonExportFields.map(field => (
              <label key={field} className={selectedExportFields.includes(field) ? "selected" : ""}>
                <input type="checkbox" checked={selectedExportFields.includes(field)} onChange={() => toggleExportField(field)} />
                <span>{comparisonExportFieldLabel(field, language)}</span>
              </label>
            ))}
          </div>
        </section>
        <footer>
          <span className="comparison-export-actions">
            <button className="comparison-export-csv" onClick={exportCsv}>
              <FileSpreadsheet size={15} />
              {text(language, "Export CSV", "CSV डाउनलोड करें")}
            </button>
            <button className="comparison-export-pdf" onClick={exportPdf}>
              <FileDown size={15} />
              {text(language, "Save as PDF", "PDF के रूप में सहेजें")}
            </button>
          </span>
          <span className="comparison-footer-note">
            <Check size={15} />
            {text(
              language,
              "Compare options, then verify the latest details on each official portal.",
              "विकल्पों की तुलना करें, फिर हर आधिकारिक पोर्टल पर नवीनतम जानकारी जाँचें।"
            )}
          </span>
        </footer>
      </section>
    </div>
  );
}
