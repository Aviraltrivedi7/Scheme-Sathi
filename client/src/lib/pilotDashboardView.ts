export type PilotDashboardFilters = {
  from: string;
  to: string;
  segment: "all" | "college" | "ngo";
  view: "month" | "quarter";
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function safeDate(value: string | null) {
  return value && datePattern.test(value) ? value : "";
}

export function parsePilotDashboardFilters(search: string): PilotDashboardFilters {
  const params = new URLSearchParams(search);
  const from = safeDate(params.get("from"));
  const to = safeDate(params.get("to"));
  const validRange = !from || !to || from <= to;
  const segment = params.get("segment");
  const view = params.get("view");
  return {
    from: validRange ? from : "",
    to: validRange ? to : "",
    segment: segment === "college" || segment === "ngo" ? segment : "all",
    view: view === "quarter" ? "quarter" : "month",
  };
}

/** Serializes only non-default, non-sensitive dashboard filters for sharing. */
export function createPilotDashboardSearch(filters: PilotDashboardFilters) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.segment !== "all") params.set("segment", filters.segment);
  if (filters.view !== "month") params.set("view", filters.view);
  const query = params.toString();
  return query ? `?${query}` : "";
}
