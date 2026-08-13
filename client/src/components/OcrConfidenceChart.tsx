import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { buildOcrConfidenceChartData, ocrConfidenceManualReviewCopy, type ConfidenceSnapshot } from "@/lib/ocrConfidenceChart";
import { AlertTriangle, ChartNoAxesColumnIncreasing, ShieldCheck } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import "./OcrConfidenceChart.css";

const chartConfig = { score: { label: "Confidence", color: "#2d5f8e" } } satisfies ChartConfig;

export function OcrConfidenceChart({ documentName, history, needsManualReview }: { documentName: string; history: ConfidenceSnapshot[]; needsManualReview: boolean }) {
  const data = buildOcrConfidenceChartData(history); const latest = history.length ? [...history].sort((a, b) => b.createdAt - a.createdAt)[0] : undefined;
  if (!data.length) return null;
  return <section className={`ocr-confidence-chart ${needsManualReview ? "manual-review" : ""}`} aria-label={`OCR confidence trend for ${documentName}`}><header><span>{needsManualReview ? <AlertTriangle size={14} /> : <ChartNoAxesColumnIncreasing size={14} />} OCR confidence trend</span><strong>{needsManualReview ? "Manual review" : "On track"}</strong></header><ChartContainer config={chartConfig} className="ocr-confidence-plot"><LineChart accessibilityLayer data={data} margin={{ top: 9, right: 8, left: -22, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="index" tickLine={false} axisLine={false} tickFormatter={(value) => `OCR ${value}`} /><YAxis domain={[1, 3]} ticks={[1, 2, 3]} tickLine={false} axisLine={false} tickFormatter={(value) => value === 1 ? "Low" : value === 2 ? "Med" : "High"} /><ReferenceLine y={2} stroke="#c48b36" strokeDasharray="4 3" /><ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.confidence ? `OCR ${payload[0].payload.index}: ${payload[0].payload.confidence} confidence` : "OCR confidence"} formatter={(_, _name, item) => <span>{item.payload.concernCount ? `${item.payload.concernCount} concern(s)` : "No concerns"}</span>} />} /><Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--color-score)" }} activeDot={{ r: 5 }} /></LineChart></ChartContainer><p>{needsManualReview ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}{ocrConfidenceManualReviewCopy(needsManualReview, latest)}</p></section>;
}
