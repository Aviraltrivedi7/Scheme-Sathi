/**
 * Shared in-process sliding-window rate limiter used by public auth endpoints
 * and AI help chat. Keys combine caller IP and (optionally) an identifier
 * like an email so a single account cannot be hammered from rotating IPs,
 * while an IP cannot hammer many accounts.
 */

export type RateLimitOptions = {
  /** Unique limiter name; keeps separate limiters' windows independent. */
  name: string;
  windowMs: number;
  max: number;
};

type WindowState = { startedAt: number; count: number };

const registries = new Map<string, Map<string, WindowState>>();

const registry = (name: string) => {
  let windows = registries.get(name);
  if (!windows) {
    windows = new Map();
    registries.set(name, windows);
  }
  return windows;
};

/** Prune expired windows once a registry grows, so keys never leak memory. */
const prune = (windows: Map<string, WindowState>, now: number, windowMs: number) => {
  if (windows.size < 500) return;
  windows.forEach((state, key) => {
    if (now - state.startedAt >= windowMs) windows.delete(key);
  });
};

/**
 * Consume one allowance. Returns true when allowed; false when the caller
 * exceeded `max` requests within the rolling window.
 */
export function consumeRateLimit(
  options: RateLimitOptions,
  keys: string[],
  now = Date.now()
): boolean {
  const windows = registry(options.name);
  prune(windows, now, options.windowMs);
  // Two-phase check-then-increment so a blocked multi-key request
  // never burns quota on the keys that passed (atomic consumption).
  const states: { id: string; state: WindowState }[] = [];
  for (const key of keys) {
    const id = `${options.name}:${key}`;
    const prior = windows.get(id);
    const current =
      !prior || now - prior.startedAt >= options.windowMs
        ? { startedAt: now, count: 0 }
        : prior;
    if (current.count >= options.max) return false;
    states.push({ id, state: current });
  }
  for (const { id, state } of states) {
    state.count += 1;
    windows.set(id, state);
  }
  return true;
}

/** Test hook: wipe a limiter's registry. */
export function resetRateLimitForTest(name?: string) {
  if (name) registries.delete(name);
  else registries.clear();
}
