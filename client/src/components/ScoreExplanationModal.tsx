import { CheckCircle2, X } from "lucide-react";
import { getScoreBreakdown, getTier, type Scheme, type UserProfile } from "@/lib/schemes";

type Language = "en" | "hi";
const text = (language: Language, english: string, hindi: string) => language === "hi" ? hindi : english;

export function ScoreExplanationModal({ scheme, profile, language, onClose }: { scheme: Scheme & { score: number; factors: string[] }; profile: UserProfile; language: Language; onClose: () => void }) {
  const breakdown = getScoreBreakdown(profile, scheme); const tier = getTier(scheme.score);
  return <div className="score-modal-backdrop" role="presentation" onClick={onClose}><section className="score-modal" role="dialog" aria-modal="true" aria-label={text(language, "Match score explanation", "मिलान स्कोर का विवरण")} onClick={(event) => event.stopPropagation()}><header><div><span className="section-kicker">{text(language, "How this score works", "यह स्कोर कैसे बनता है")}</span><h2>{text(language, `${scheme.score} — ${tier.label}`, `${scheme.score} — ${tier.labelHi}`)}</h2><p>{text(language, "This score only adds points for matching criteria. It does not confirm final eligibility.", "यह स्कोर केवल मेल खाते मानदंडों के लिए अंक जोड़ता है। यह अंतिम पात्रता की पुष्टि नहीं करता।")}</p></div><button onClick={onClose} aria-label={text(language, "Close score explanation", "स्कोर विवरण बंद करें")}><X size={19} /></button></header><div className="score-breakdown">{breakdown.map((item) => <article className={item.matched ? "matched" : "unmatched"} key={item.key}><span>{item.matched ? <CheckCircle2 size={15} /> : "0"}</span><div><strong>{item.matched ? `+${item.points}` : "0"}</strong><p>{text(language, item.english, item.hindi)}</p></div></article>)}</div><footer>{text(language, "Always confirm the official eligibility criteria before applying.", "आवेदन से पहले हमेशा आधिकारिक पात्रता मानदंड जाँचें।")}</footer></section></div>;
}
