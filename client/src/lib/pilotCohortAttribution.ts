export const pendingPilotCohortKey = "scheme-sathi:pilot-cohort";
export const pilotVisitorTokenKey = "scheme-sathi:pilot-visitor";

export function getOrCreatePilotVisitorToken() {
  const existing = localStorage.getItem(pilotVisitorTokenKey);
  if (existing) return existing;
  const token = crypto.randomUUID();
  localStorage.setItem(pilotVisitorTokenKey, token);
  return token;
}
