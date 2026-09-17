import { afterEach, describe, expect, it } from "vitest";
import { consumeRateLimit, resetRateLimitForTest } from "./rateLimit";

const LIMIT = { name: "test-limiter", windowMs: 60_000, max: 3 };

afterEach(() => {
  resetRateLimitForTest();
});

describe("consumeRateLimit", () => {
  it("allows up to max hits within the window then blocks", () => {
    const now = 1_000_000;
    for (let i = 0; i < LIMIT.max; i++) {
      expect(consumeRateLimit(LIMIT, ["ip:1"], now + i)).toBe(true);
    }
    expect(consumeRateLimit(LIMIT, ["ip:1"], now + LIMIT.max)).toBe(false);
  });

  it("rejects as soon as any key in the set is exhausted", () => {
    const now = 5_000_000;
    for (let i = 0; i < LIMIT.max; i++) {
      consumeRateLimit(LIMIT, ["shared-key"], now + i);
    }
    // The fresh ip key alone would pass, but the exhausted shared key fails it.
    expect(consumeRateLimit(LIMIT, ["ip:9", "shared-key"], now + 10)).toBe(false);
  });

  it("resets after the window elapses (sliding window per key)", () => {
    const now = 10_000_000;
    for (let i = 0; i < LIMIT.max; i++) {
      consumeRateLimit(LIMIT, ["ip:2"], now + i);
    }
    expect(consumeRateLimit(LIMIT, ["ip:2"], now + LIMIT.max)).toBe(false);
    // One millisecond past the window the key gets a fresh allowance.
    expect(
      consumeRateLimit(LIMIT, ["ip:2"], now + LIMIT.windowMs + LIMIT.max + 1)
    ).toBe(true);
  });

  it("tracks separate limiters independently", () => {
    const other = { name: "other-limiter", windowMs: 60_000, max: 1 };
    const now = 20_000_000;
    expect(consumeRateLimit(LIMIT, ["ip:3"], now)).toBe(true);
    expect(consumeRateLimit(LIMIT, ["ip:3"], now)).toBe(true);
    expect(consumeRateLimit(other, ["ip:3"], now)).toBe(true);
    expect(consumeRateLimit(other, ["ip:3"], now)).toBe(false);
  });

  it("resetRateLimitForTest(name) only clears the named registry", () => {
    const now = 30_000_000;
    consumeRateLimit(LIMIT, ["ip:4"], now);
    consumeRateLimit({ name: "keep-me", windowMs: 60_000, max: 1 }, ["ip:4"], now);
    resetRateLimitForTest("test-limiter");
    expect(consumeRateLimit(LIMIT, ["ip:4"], now + 1)).toBe(true);
    expect(
      consumeRateLimit({ name: "keep-me", windowMs: 60_000, max: 1 }, ["ip:4"], now + 1)
    ).toBe(false);
  });

  it("does not consume any allowance when the request is already over limit", () => {
    const now = 40_000_000;
    // Exhaust "blocked" under the shared test-limiter.
    for (let i = 0; i < LIMIT.max; i++) {
      consumeRateLimit(LIMIT, ["blocked"], now + i);
    }
    // Multi-key call fails at the first exhausted key and must not count
    // "spared" — otherwise blocked callers would burn others' allowances.
    expect(consumeRateLimit(LIMIT, ["blocked", "spared"], now + 10)).toBe(false);
    expect(consumeRateLimit(LIMIT, ["spared"], now + 11)).toBe(true);
    expect(consumeRateLimit(LIMIT, ["spared"], now + 12)).toBe(true);
    expect(consumeRateLimit(LIMIT, ["spared"], now + 13)).toBe(true);
    expect(consumeRateLimit(LIMIT, ["spared"], now + 14)).toBe(false);
  });
});
