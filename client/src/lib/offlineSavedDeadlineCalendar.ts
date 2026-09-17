import type { Scheme } from "@/lib/schemes";

export type OfflineDeadlineCalendarDay = { date: Date; schemes: Scheme[]; isCurrentMonth: boolean };
export type OfflineDeadlineTiming = "urgent" | "soon" | "later";

export function getOfflineDeadlineTiming(deadline: number, now = Date.now()): OfflineDeadlineTiming {
  const days = Math.ceil((deadline - now) / 86_400_000);
  if (days <= 7) return "urgent";
  if (days <= 30) return "soon";
  return "later";
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildOfflineSavedDeadlineCalendar(schemes: Scheme[], month: Date, now = Date.now()): OfflineDeadlineCalendarDay[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayStartOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - mondayStartOffset);
  const deadlineMap = new Map<string, Scheme[]>();
  schemes.filter(scheme => scheme.applicationDeadline && scheme.applicationDeadline > now).forEach(scheme => {
    const key = dateKey(new Date(scheme.applicationDeadline!));
    deadlineMap.set(key, [...(deadlineMap.get(key) ?? []), scheme]);
  });
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { date, schemes: deadlineMap.get(dateKey(date)) ?? [], isCurrentMonth: date.getMonth() === month.getMonth() };
  });
}
