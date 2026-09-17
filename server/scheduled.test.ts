import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getReminder: vi.fn(),
  markDelivered: vi.fn(),
  disableHeartbeat: vi.fn(),
  getDocumentSetting: vi.fn(),
  scanDocuments: vi.fn(),
  markDocumentScan: vi.fn(),
  deliverReviewDueReminder: vi.fn(),
  getDb: vi.fn(),
  getSyncSetting: vi.fn(),
  runSyncSources: vi.fn(),
}));

vi.mock("./db", () => ({
  getApplicationReminderByTaskUid: mocks.getReminder,
  markApplicationReminderDelivered: mocks.markDelivered,
  getDocumentReminderSettingByTaskUid: mocks.getDocumentSetting,
  scanDocumentExpiryNotifications: mocks.scanDocuments,
  markDocumentReminderScanRun: mocks.markDocumentScan,
  deliverDocumentReviewDueReminder: mocks.deliverReviewDueReminder,
  getDb: mocks.getDb,
  getSchemeSyncSettingByTaskUid: mocks.getSyncSetting,
  runAllEnabledSchemeSources: mocks.runSyncSources,
}));
vi.mock("./_core/heartbeat", () => ({ updateHeartbeatJob: mocks.disableHeartbeat }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));

import { applicationReminderHandler, documentExpiryReminderHandler, documentReviewDueReminderHandler, schemeSyncHandler } from "./scheduled";

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

describe("scheduled document expiry callback", () => {
  it("runs a durable task-UID-bound scan and records its completed run", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "doc_task_123" });
    mocks.getDocumentSetting.mockResolvedValue({ id: "daily-document-expiry", scheduleCronTaskUid: "doc_task_123" });
    mocks.scanDocuments.mockResolvedValue({ scanned: 4, created: 2 });
    mocks.markDocumentScan.mockResolvedValue(undefined);
    const response = createResponse();

    await documentExpiryReminderHandler({} as any, response as any);

    expect(mocks.getDocumentSetting).toHaveBeenCalledWith("doc_task_123");
    expect(mocks.markDocumentScan).toHaveBeenCalledWith("daily-document-expiry");
    expect(response.json).toHaveBeenCalledWith({ ok: true, scanned: 4, created: 2 });
  });

  it("does not run the scan for callers outside the cron identity", async () => {
    mocks.scanDocuments.mockClear();
    mocks.authenticateRequest.mockResolvedValue({ isCron: false });
    const response = createResponse();

    await documentExpiryReminderHandler({} as any, response as any);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(mocks.scanDocuments).not.toHaveBeenCalled();
  });
});

describe("scheduled reviewer due-date callback", () => {
  it("uses the authenticated task UID to deliver one reminder and disables the one-time job", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "review_due_123" });
    mocks.deliverReviewDueReminder.mockResolvedValue({ delivered: true, skipped: null, assignmentId: 14 });
    mocks.disableHeartbeat.mockResolvedValue({});
    const response = createResponse();
    await documentReviewDueReminderHandler({} as any, response as any);
    expect(mocks.deliverReviewDueReminder).toHaveBeenCalledWith("review_due_123");
    expect(mocks.disableHeartbeat).toHaveBeenCalledWith("review_due_123", { enable: false }, "");
    expect(response.json).toHaveBeenCalledWith({ ok: true, delivered: true, skipped: null, assignmentId: 14 });
  });
});

describe("scheduled catalog sync bot", () => {
  it("runs enabled sources for the authenticated sync task UID", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "sync_task_1" });
    mocks.getDb.mockResolvedValue({});
    mocks.getSyncSetting.mockResolvedValue({ id: "daily", scheduleCronTaskUid: "sync_task_1" });
    mocks.runSyncSources.mockResolvedValue([{ sourceId: "s1", ok: true, message: "1 new" }]);
    const response = createResponse();

    await schemeSyncHandler({} as any, response as any);

    expect(mocks.getSyncSetting).toHaveBeenCalledWith("sync_task_1");
    expect(mocks.runSyncSources).toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      sources: 1,
      outcomes: [{ sourceId: "s1", ok: true, message: "1 new" }],
    });
  });

  it("skips orphan task UIDs without running any source", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "unknown_task" });
    mocks.getDb.mockResolvedValue({});
    mocks.getSyncSetting.mockResolvedValue(null);
    mocks.runSyncSources.mockClear();
    const response = createResponse();

    await schemeSyncHandler({} as any, response as any);

    expect(mocks.runSyncSources).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ ok: true, skipped: "orphan" });
  });

  it("skips gracefully without a database instead of failing", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "sync_task_1" });
    mocks.getDb.mockResolvedValue(null);
    mocks.runSyncSources.mockClear();
    const response = createResponse();

    await schemeSyncHandler({} as any, response as any);

    expect(mocks.runSyncSources).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ ok: true, skipped: "no-database" });
  });

  it("rejects non-cron callers", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: false });
    const response = createResponse();

    await schemeSyncHandler({} as any, response as any);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "cron-only" });
  });
});
