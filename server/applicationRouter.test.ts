import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  listSchemeCatalog: vi.fn(), getSchemeById: vi.fn(), getUserSchemeProfile: vi.fn(), listSavedSchemeIds: vi.fn(), saveUserSchemeProfile: vi.fn(), toggleSavedScheme: vi.fn(),
  listTrackedApplications: vi.fn(), trackSchemeApplication: vi.fn(), updateTrackedApplication: vi.fn(), getOcrPolicy: vi.fn(),
  createApplicationReminder: vi.fn(), assignReminderHeartbeat: vi.fn(), cancelApplicationReminder: vi.fn(),
}));

vi.mock("./db", () => mocks);
vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob: vi.fn(), deleteHeartbeatJob: vi.fn() }));

import { appRouter } from "./routers";

function authenticatedContext(): TrpcContext {
  return {
    user: { id: 42, openId: "application-test-user", email: null, name: "Test User", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("application tracker router", () => {
  it("returns the configured OCR policy alongside the authenticated user's applications", async () => {
    mocks.listTrackedApplications.mockResolvedValue([]);
    mocks.getOcrPolicy.mockResolvedValue({ id: "default", minimumConfidence: "high" });
    const result = await appRouter.createCaller(authenticatedContext()).applications.list();
    expect(mocks.listTrackedApplications).toHaveBeenCalledWith(42);
    expect(result.ocrPolicy.minimumConfidence).toBe("high");
  });

  it("tracks a scheme for the authenticated owner", async () => {
    mocks.trackSchemeApplication.mockResolvedValue({ id: 9, userId: 42, schemeId: "nsp", status: "considering" });
    const caller = appRouter.createCaller(authenticatedContext());

    const result = await caller.applications.track({ schemeId: "nsp" });

    expect(mocks.trackSchemeApplication).toHaveBeenCalledWith(42, "nsp");
    expect(result.application).toMatchObject({ id: 9, schemeId: "nsp", status: "considering" });
  });

  it("writes status and reference updates only for the authenticated owner", async () => {
    mocks.updateTrackedApplication.mockResolvedValue({ id: 9, userId: 42, status: "submitted", applicationReference: "APP-2026-91" });
    const caller = appRouter.createCaller(authenticatedContext());

    await caller.applications.update({ trackedApplicationId: 9, status: "submitted", applicationReference: "APP-2026-91" });

    expect(mocks.updateTrackedApplication).toHaveBeenCalledWith(42, 9, { status: "submitted", applicationReference: "APP-2026-91" });
  });
});
