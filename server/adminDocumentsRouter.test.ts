import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  listSchemeCatalog: vi.fn(), updateSchemeAdmin: vi.fn(), uploadApplicationDocument: vi.fn(), removeApplicationDocument: vi.fn(),
  getSchemeById: vi.fn(), getUserSchemeProfile: vi.fn(), listSavedSchemeIds: vi.fn(), saveUserSchemeProfile: vi.fn(), toggleSavedScheme: vi.fn(),
  listTrackedApplications: vi.fn(), trackSchemeApplication: vi.fn(), updateTrackedApplication: vi.fn(), createApplicationReminder: vi.fn(), assignReminderHeartbeat: vi.fn(), cancelApplicationReminder: vi.fn(),
}));
vi.mock("./db", () => mocks);
vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob: vi.fn(), deleteHeartbeatJob: vi.fn() }));

import { appRouter } from "./routers";

function context(role: "user" | "admin"): TrpcContext {
  return { user: { id: 5, openId: `${role}-open-id`, email: null, name: role, loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: { clearCookie: vi.fn() } as TrpcContext["res"] };
}

describe("document and admin routers", () => {
  it("passes document uploads through the authenticated application owner", async () => {
    mocks.uploadApplicationDocument.mockResolvedValue({ id: 3, documentName: "Income certificate" });
    const result = await appRouter.createCaller(context("user")).documents.upload({ trackedApplicationId: 12, documentName: "Income certificate", fileName: "income.pdf", mimeType: "application/pdf", base64Data: "cGRm" });
    expect(mocks.uploadApplicationDocument).toHaveBeenCalledWith(5, 12, "Income certificate", "income.pdf", "application/pdf", "cGRm");
    expect(result.document).toMatchObject({ id: 3 });
  });

  it("allows only admins to update official scheme content", async () => {
    mocks.updateSchemeAdmin.mockResolvedValue({ id: "nsp", name: "National Scholarship Portal" });
    const admin = appRouter.createCaller(context("admin"));
    await admin.admin.schemes.update({ schemeId: "nsp", deadlineLabel: "Applications close 31 Oct 2026" });
    expect(mocks.updateSchemeAdmin).toHaveBeenCalledWith("nsp", { deadlineLabel: "Applications close 31 Oct 2026" });

    await expect(appRouter.createCaller(context("user")).admin.schemes.list()).rejects.toThrow();
  });
});
