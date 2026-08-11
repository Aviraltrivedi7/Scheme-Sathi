import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getReminder: vi.fn(),
  markDelivered: vi.fn(),
  disableHeartbeat: vi.fn(),
}));

vi.mock("./db", () => ({
  getApplicationReminderByTaskUid: mocks.getReminder,
  markApplicationReminderDelivered: mocks.markDelivered,
}));
vi.mock("./_core/heartbeat", () => ({ updateHeartbeatJob: mocks.disableHeartbeat }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));

import { applicationReminderHandler } from "./scheduled";

function createResponse() {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  return response;
}

describe("scheduled application reminder callback", () => {
  it("uses the authenticated task UID, records delivery, and disables its one-time job", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task_123" });
    mocks.getReminder.mockResolvedValue({ id: 7, trackedApplicationId: 11, status: "scheduled" });
    mocks.markDelivered.mockResolvedValue(undefined);
    mocks.disableHeartbeat.mockResolvedValue({});
    const response = createResponse();

    await applicationReminderHandler({} as any, response as any);

    expect(mocks.getReminder).toHaveBeenCalledWith("task_123");
    expect(mocks.markDelivered).toHaveBeenCalledWith(7);
    expect(mocks.disableHeartbeat).toHaveBeenCalledWith("task_123", { enable: false }, "");
    expect(response.json).toHaveBeenCalledWith({ ok: true, reminderId: 7, applicationId: 11 });
  });

  it("rejects non-cron callers without reading reminder data", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: false });
    const response = createResponse();

    await applicationReminderHandler({} as any, response as any);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "cron-only" });
  });
});
