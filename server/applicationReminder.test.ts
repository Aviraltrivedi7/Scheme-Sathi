import { describe, expect, it } from "vitest";
import { buildReminderCron } from "./applicationReminder";

describe("application reminder scheduling", () => {
  it("creates a UTC six-field cron expression for the selected reminder time", () => {
    expect(buildReminderCron(Date.UTC(2026, 9, 31, 18, 29, 0))).toBe("0 29 18 31 10 *");
  });
});
