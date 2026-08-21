import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { Scheme } from "@/lib/schemes";
import { buildOfflineSavedDeadlineCalendar, getOfflineDeadlineTiming } from "@/lib/offlineSavedDeadlineCalendar";

type Language = "en" | "hi";
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function OfflineSavedDeadlineCalendar({ schemes, language, onOpen = scheme => { window.dispatchEvent(new CustomEvent<Scheme>("scheme-sathi-open-offline-saved", { detail: scheme })); } }: { schemes: Scheme[]; language: Language; onOpen?: (scheme: Scheme) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const days = useMemo(() => buildOfflineSavedDeadlineCalendar(schemes, month), [schemes, month]);
  const formatter = new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", { month: "long", year: "numeric" });
  const isHindi = language === "hi";
  return <section className="offline-deadline-calendar" aria-label={isHindi ? "सहेजी योजनाओं की समयसीमा कैलेंडर" : "Saved scheme deadline calendar"}><header><div><p><CalendarDays size={14} /> {isHindi ? "समयसीमा कैलेंडर" : "DEADLINE CALENDAR"}</p><h2>{formatter.format(month)}</h2></div><div className="offline-calendar-nav"><button type="button" onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label={isHindi ? "पिछला महीना" : "Previous month"}><ChevronLeft size={17} /></button><button type="button" onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label={isHindi ? "अगला महीना" : "Next month"}><ChevronRight size={17} /></button></div></header><div className="offline-calendar-legend" aria-label={isHindi ? "समयसीमा रंग संकेत" : "Deadline color legend"}><span className="urgent"><i />{isHindi ? "7 दिन के भीतर" : "Within 7 days"}</span><span className="soon"><i />{isHindi ? "8–30 दिन" : "8–30 days"}</span><span className="later"><i />{isHindi ? "30 दिन से बाद" : "After 30 days"}</span></div><div className="offline-calendar-weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div><div className="offline-calendar-grid">{days.map(({ date, schemes: dueSchemes, isCurrentMonth }) => <div key={date.toISOString()} className={`offline-calendar-day ${isCurrentMonth ? "" : "muted"} ${dueSchemes.length ? "has-deadline" : ""}`}><time dateTime={date.toISOString().slice(0, 10)}>{date.getDate()}</time>{dueSchemes.slice(0, 2).map(scheme => <button type="button" className={`deadline-${getOfflineDeadlineTiming(scheme.applicationDeadline!)}`} key={scheme.id} onClick={() => onOpen(scheme)} title={isHindi ? scheme.nameHindi : scheme.name}>{isHindi ? scheme.nameHindi : scheme.name}</button>)}{dueSchemes.length > 2 && <span>+{dueSchemes.length - 2}</span>}</div>)}</div></section>;
}
