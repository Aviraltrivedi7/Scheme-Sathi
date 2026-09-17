import { describe, expect, it } from "vitest";
import { nextCronMatch } from "./localScheduler";

describe("standalone scheduler cron matching", () => {
  it("resolves the next one-shot reminder minute", () => {
    const from = new Date(Date.UTC(2026, 8, 4, 10, 0, 30));
    // Fire at 10:05 UTC on 4 Sep: `0 5 10 4 9 *`
    const next = nextCronMatch("0 5 10 4 9 *", from);
    expect(new Date(next).toISOString()).toBe("2026-09-04T10:05:00.000Z");
  });

  it("skips ahead to the next year when the month's day has passed", () => {
    const from = new Date(Date.UTC(2026, 8, 30, 12, 0, 0));
    const next = nextCronMatch("0 0 3 5 9 *", from);
    expect(new Date(next).toISOString()).toBe("2027-09-05T03:00:00.000Z");
  });

  it("resolves the daily 03:00 UTC scan for tomorrow when today's has passed", () => {
    const from = new Date(Date.UTC(2026, 8, 4, 5, 0, 0));
    const next = nextCronMatch("0 0 3 * * *", from);
    expect(new Date(next).toISOString()).toBe("2026-09-05T03:00:00.000Z");
  });

  it("rejects malformed cron expressions", () => {
    expect(() => nextCronMatch("0 5 10")).toThrow();
  });

  it("supports step values for the 5-minute sync bot", () => {
    const from = new Date(Date.UTC(2026, 8, 4, 10, 0, 30));
    const next = nextCronMatch("0 */5 * * * *", from);
    expect(new Date(next).toISOString()).toBe("2026-09-04T10:05:00.000Z");
  });

  it("lands on the next 5-minute boundary mid-hour", () => {
    const from = new Date(Date.UTC(2026, 8, 4, 10, 7, 0));
    const next = nextCronMatch("0 */5 * * * *", from);
    expect(new Date(next).toISOString()).toBe("2026-09-04T10:10:00.000Z");
  });
});
