import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  listSchemeCatalog: vi.fn(), updateSchemeAdmin: vi.fn(), uploadApplicationDocument: vi.fn(), removeApplicationDocument: vi.fn(), updateApplicationDocumentExpiry: vi.fn(), listDocumentExpiryNotifications: vi.fn(), markDocumentExpiryNotificationRead: vi.fn(), getDocumentReminderSetting: vi.fn(), saveDocumentReminderTask: vi.fn(), getApplicationDocumentPreview: vi.fn(), runApplicationDocumentOcr: vi.fn(), approveApplicationDocumentOcr: vi.fn(), getOcrPolicy: vi.fn(), updateOcrPolicy: vi.fn(), listDocumentVerificationHistory: vi.fn(), exportDocumentVerificationHistoryPdf: vi.fn(), runBatchDocumentOcr: vi.fn(), approveBatchDocumentOcr: vi.fn(), listSavedVerificationHistoryFilters: vi.fn(), saveVerificationHistoryFilter: vi.fn(), removeSavedVerificationHistoryFilter: vi.fn(),
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
    const result = await appRouter.createCaller(context("user")).documents.upload({ trackedApplicationId: 12, documentName: "Income certificate", fileName: "income.pdf", mimeType: "application/pdf", base64Data: "cGRm", expiresAt: 1790000000000 });
    expect(mocks.uploadApplicationDocument).toHaveBeenCalledWith(5, 12, "Income certificate", "income.pdf", "application/pdf", "cGRm", 1790000000000);
    expect(result.document).toMatchObject({ id: 3 });
  });

  it("allows only admins to update official scheme content", async () => {
    mocks.updateSchemeAdmin.mockResolvedValue({ id: "nsp", name: "National Scholarship Portal" });
    const admin = appRouter.createCaller(context("admin"));
    await admin.admin.schemes.update({ schemeId: "nsp", deadlineLabel: "Applications close 31 Oct 2026" });
    expect(mocks.updateSchemeAdmin).toHaveBeenCalledWith("nsp", { deadlineLabel: "Applications close 31 Oct 2026" });

    await expect(appRouter.createCaller(context("user")).admin.schemes.list()).rejects.toThrow();
  });

  it("keeps document preview and OCR extraction scoped to the authenticated owner", async () => {
    mocks.getApplicationDocumentPreview.mockResolvedValue({ documentId: 3, fileName: "income.pdf", mimeType: "application/pdf", url: "https://signed.example/preview" });
    mocks.runApplicationDocumentOcr.mockResolvedValue({ documentType: "Income certificate", detectedName: null, referenceNumbers: [], dates: [], keyDetails: ["Income shown"], concerns: [], confidence: "medium" });
    const caller = appRouter.createCaller(context("user"));

    const preview = await caller.documents.preview({ documentId: 3 });
    const extraction = await caller.documents.extract({ documentId: 3 });

    expect(mocks.getApplicationDocumentPreview).toHaveBeenCalledWith(5, 3);
    expect(mocks.runApplicationDocumentOcr).toHaveBeenCalledWith(5, 3);
    expect(preview.preview.fileName).toBe("income.pdf");
    expect(extraction.extraction.confidence).toBe("medium");
  });

  it("records owner approval only after a user confirms OCR details", async () => {
    mocks.approveApplicationDocumentOcr.mockResolvedValue(undefined);
    const result = await appRouter.createCaller(context("user")).documents.approveOcr({ documentId: 3 });
    expect(mocks.approveApplicationDocumentOcr).toHaveBeenCalledWith(5, 3);
    expect(result).toEqual({ approved: true });
  });

  it("allows only admins to adjust the OCR manual-review threshold", async () => {
    mocks.updateOcrPolicy.mockResolvedValue({ id: "default", minimumConfidence: "high" });
    const result = await appRouter.createCaller(context("admin")).admin.ocrPolicy.update({ minimumConfidence: "high" });
    expect(mocks.updateOcrPolicy).toHaveBeenCalledWith(5, "high");
    expect(result.policy).toMatchObject({ minimumConfidence: "high" });
    await expect(appRouter.createCaller(context("user")).admin.ocrPolicy.get()).rejects.toThrow();
  });

  it("filters owner-scoped history and exports only that selected history as a PDF", async () => {
    mocks.listDocumentVerificationHistory.mockResolvedValue([{ documentId: 3, documentName: "Income certificate", fileName: "income.pdf", mimeType: "application/pdf", schemeName: "National Scholarship Portal", kind: "userVerified", detail: null, createdAt: 1790000000000 }]);
    mocks.exportDocumentVerificationHistoryPdf.mockResolvedValue({ fileName: "history.pdf", base64Data: "JVBERg==", eventCount: 1 });
    const caller = appRouter.createCaller(context("user"));
    const filters = { startAt: 1790000000000, endAt: 1795000000000, sort: "oldest" as const };
    const history = await caller.documents.history(filters);
    const pdf = await caller.documents.exportHistoryPdf(filters);
    expect(mocks.listDocumentVerificationHistory).toHaveBeenCalledWith(5, filters);
    expect(mocks.exportDocumentVerificationHistoryPdf).toHaveBeenCalledWith(5, filters);
    expect(history.events).toHaveLength(1);
    expect(history.events[0]).toMatchObject({ documentId: 3, mimeType: "application/pdf" });
    expect(pdf.fileName).toBe("history.pdf");
  });

  it("returns per-document outcomes for batch OCR and batch approval without treating a partial failure as total failure", async () => {
    const outcomes = [{ documentId: 3, ok: true }, { documentId: 4, ok: false, message: "Manual retry required" }];
    mocks.runBatchDocumentOcr.mockResolvedValue(outcomes);
    mocks.approveBatchDocumentOcr.mockResolvedValue(outcomes);
    const caller = appRouter.createCaller(context("user"));
    const ocr = await caller.documents.batchExtract({ documentIds: [3, 3, 4] });
    const approval = await caller.documents.batchApproveOcr({ documentIds: [3, 4] });
    expect(mocks.runBatchDocumentOcr).toHaveBeenCalledWith(5, [3, 4]);
    expect(mocks.approveBatchDocumentOcr).toHaveBeenCalledWith(5, [3, 4]);
    expect(ocr.outcomes.filter((outcome) => !outcome.ok)).toHaveLength(1);
    expect(approval.outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
  });

  it("keeps saved verification-history filters private to the authenticated owner", async () => {
    const filter = { id: 12, name: "Scholarship documents", query: "income", startAt: 1790000000000, endAt: undefined, sort: "newest" as const, createdAt: 1790000000000, updatedAt: 1790000000000 };
    mocks.listSavedVerificationHistoryFilters.mockResolvedValue([filter]);
    mocks.saveVerificationHistoryFilter.mockResolvedValue(filter);
    mocks.removeSavedVerificationHistoryFilter.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context("user"));
    const listed = await caller.documents.historyFilters.list();
    const saved = await caller.documents.historyFilters.save({ name: "Scholarship documents", query: "income", startAt: 1790000000000, sort: "newest" });
    const removed = await caller.documents.historyFilters.remove({ filterId: 12 });
    expect(mocks.listSavedVerificationHistoryFilters).toHaveBeenCalledWith(5);
    expect(mocks.saveVerificationHistoryFilter).toHaveBeenCalledWith(5, { name: "Scholarship documents", query: "income", startAt: 1790000000000, sort: "newest" });
    expect(mocks.removeSavedVerificationHistoryFilter).toHaveBeenCalledWith(5, 12);
    expect(listed.filters).toEqual([filter]);
    expect(saved.filter).toEqual(filter);
    expect(removed).toEqual({ removed: true });
  });
});
