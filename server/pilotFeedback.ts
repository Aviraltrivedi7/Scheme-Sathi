const requestWindows = new Map<string, { startedAt: number; count: number }>();

export const PILOT_FEEDBACK_WINDOW_MS = 10 * 60_000;
export const PILOT_FEEDBACK_MAX_PER_WINDOW = 5;

/** Returns false once an IP has exhausted its small public pilot-feedback allowance. */
export function consumePilotFeedbackQuota(requestKey: string, now = Date.now()) {
  pruneRequestWindows(now);
  const prior = requestWindows.get(requestKey);
  const current =
    !prior || now - prior.startedAt >= PILOT_FEEDBACK_WINDOW_MS
      ? { startedAt: now, count: 0 }
      : prior;
  if (current.count >= PILOT_FEEDBACK_MAX_PER_WINDOW) return false;
  current.count += 1;
  requestWindows.set(requestKey, current);
  return true;
}

/** Drops closed windows so a long-running server does not accumulate one map entry per IP forever. */
function pruneRequestWindows(now: number) {
  if (requestWindows.size < 500) return;
  requestWindows.forEach((window, key) => {
    if (now - window.startedAt >= PILOT_FEEDBACK_WINDOW_MS)
      requestWindows.delete(key);
  });
}

export function resetPilotFeedbackQuotaForTest() {
  requestWindows.clear();
}
