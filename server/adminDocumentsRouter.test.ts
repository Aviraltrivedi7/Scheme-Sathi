import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  listSchemeCatalog: vi.fn(), updateSchemeAdmin: vi.fn(), uploadApplicationDocument: vi.fn(), removeApplicationDocument: vi.fn(), updateApplicationDocumentExpiry: vi.fn(), listDocumentExpiryNotifications: vi.fn(), markDocumentExpiryNotificationRead: vi.fn(), getDocumentReminderSetting: vi.fn(), saveDocumentReminderTask: vi.fn(), getApplicationDocumentPreview: vi.fn(), runApplicationDocumentOcr: vi.fn(), approveApplicationDocumentOcr: vi.fn(), setApplicationDocumentReviewState: vi.fn(), listDocumentReviewAssignments: vi.fn(), assignDocumentReviewer: vi.fn(), revokeDocumentReviewer: vi.fn(), listMyDocumentReviewAssignments: vi.fn(), updateMyDocumentReviewAssignment: vi.fn(), listDocumentReviewAudit: vi.fn(), listDocumentReviewAssignmentNotifications: vi.fn(), markDocumentReviewAssignmentNotificationRead: vi.fn(), getDocumentReviewerAlertPreferences: vi.fn(), saveDocumentReviewerAlertPreferences: vi.fn(), setDocumentReviewAssignmentDueDate: vi.fn(), assignDocumentReviewDueReminderTask: vi.fn(), cancelDocumentReviewDueReminder: vi.fn(), listDocumentPdfAnnotations: vi.fn(), saveDocumentPdfAnnotation: vi.fn(), deleteDocumentPdfAnnotation: vi.fn(), getOcrPolicy: vi.fn(), updateOcrPolicy: vi.fn(), listDocumentVerificationHistory: vi.fn(), exportDocumentVerificationHistoryPdf: vi.fn(), exportDocumentVerificationHistoryCsv: vi.fn(), runBatchDocumentOcr: vi.fn(), approveBatchDocumentOcr: vi.fn(), listSavedVerificationHistoryFilters: vi.fn(), saveVerificationHistoryFilter: vi.fn(), removeSavedVerificationHistoryFilter: vi.fn(), setDefaultVerificationHistoryFilter: vi.fn(), listVerificationHistoryFilterShares: vi.fn(), listReceivedVerificationHistoryFilters: vi.fn(), listReceivedVerificationHistoryFilterInvites: vi.fn(), listFamilyFilterInvitationNotifications: vi.fn(), markFamilyFilterInvitationNotificationRead: vi.fn(), shareVerificationHistoryFilter: vi.fn(), revokeVerificationHistoryFilterShare: vi.fn(), respondToVerificationHistoryFilterInvite: vi.fn(),
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
    mocks.uploadApplicationDocument.mockResolvedValue({ id: 3, documentName: "Income certificate", fileName: "income.pdf", mimeType: "application/pdf", expiresAt: new Date(1790000000000), storageUrl: "/manus-storage/private-key" });
    const result = await appRouter.createCaller(context("user")).documents.upload({ trackedApplicationId: 12, documentName: "Income certificate", fileName: "income.pdf", mimeType: "application/pdf", base64Data: "cGRm", expiresAt: 1790000000000 });
    expect(mocks.uploadApplicationDocument).toHaveBeenCalledWith(5, 12, "Income certificate", "income.pdf", "application/pdf", "cGRm", 1790000000000);
    expect(result.document).toMatchObject({ id: 3, fileName: "income.pdf", mimeType: "application/pdf", expiresAt: 1790000000000 });
    expect(result.document).not.toHaveProperty("storageUrl");
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

  it("saves review state and creates CSV only through the authenticated document owner with the active filters", async () => {
    mocks.setApplicationDocumentReviewState.mockResolvedValue(undefined);
    mocks.exportDocumentVerificationHistoryCsv.mockResolvedValue({ fileName: "history.csv", csv: '"Timestamp"\r\n"2026-01-01"', eventCount: 1 });
    const caller = appRouter.createCaller(context("user"));
    const filters = { startAt: 1790000000000, sort: "newest" as const, query: "income" };
    const reviewed = await caller.documents.setReviewState({ documentId: 3, reviewState: "reviewed" });
    const flagged = await caller.documents.setReviewState({ documentId: 3, reviewState: "flagged" });
    const csv = await caller.documents.exportHistoryCsv(filters);
    expect(mocks.setApplicationDocumentReviewState).toHaveBeenNthCalledWith(1, 5, 3, "reviewed");
    expect(mocks.setApplicationDocumentReviewState).toHaveBeenNthCalledWith(2, 5, 3, "flagged");
    expect(mocks.exportDocumentVerificationHistoryCsv).toHaveBeenCalledWith(5, filters);
    expect(reviewed).toEqual({ updated: true });
    expect(flagged).toEqual({ updated: true });
    expect(csv).toMatchObject({ fileName: "history.csv", eventCount: 1 });
  });

  it("keeps reviewer assignment, audit records, and page notes behind the authenticated account boundary", async () => {
    const assignments = [{ id: 14, reviewerUserId: 8, reviewerName: "Family Reviewer", reviewerEmail: "reviewer@example.com", status: "assigned", assignedAt: 1790000000000, completedAt: null, revokedAt: null, updatedAt: 1790000000000 }];
    const audit = [{ id: 20, assignmentId: 14, actorName: "Owner", kind: "assigned", detail: "Assigned Family Reviewer.", createdAt: 1790000000000 }];
    const annotations = [{ id: 7, pageNumber: 2, note: "Check date carefully.", createdAt: 1790000000000, updatedAt: 1790000000000 }];
    mocks.listDocumentReviewAssignments.mockResolvedValue(assignments); mocks.assignDocumentReviewer.mockResolvedValue(assignments); mocks.listMyDocumentReviewAssignments.mockResolvedValue([]); mocks.listDocumentReviewAudit.mockResolvedValue(audit); mocks.listDocumentPdfAnnotations.mockResolvedValue(annotations); mocks.saveDocumentPdfAnnotation.mockResolvedValue(7); mocks.deleteDocumentPdfAnnotation.mockResolvedValue(undefined); mocks.updateMyDocumentReviewAssignment.mockResolvedValue(undefined); mocks.revokeDocumentReviewer.mockResolvedValue({ previousTaskUid: null });
    const caller = appRouter.createCaller(context("user"));
    const assigned = await caller.documents.reviewers.assign({ documentId: 3, reviewerEmail: "reviewer@example.com" });
    const mine = await caller.documents.reviewers.mine(); const events = await caller.documents.reviewers.audit({ documentId: 3 }); const notes = await caller.documents.annotations.list({ documentId: 3 }); const saved = await caller.documents.annotations.save({ documentId: 3, pageNumber: 2, note: "Check date carefully." }); await caller.documents.annotations.remove({ annotationId: 7 }); await caller.documents.reviewers.updateMine({ assignmentId: 14, status: "inReview" }); await caller.documents.reviewers.revoke({ assignmentId: 14 });
    expect(mocks.assignDocumentReviewer).toHaveBeenCalledWith(5, 3, "reviewer@example.com"); expect(mocks.listMyDocumentReviewAssignments).toHaveBeenCalledWith(5); expect(mocks.listDocumentReviewAudit).toHaveBeenCalledWith(5, 3, { startAt: undefined, endAt: undefined, kinds: undefined }); expect(mocks.listDocumentPdfAnnotations).toHaveBeenCalledWith(5, 3); expect(mocks.saveDocumentPdfAnnotation).toHaveBeenCalledWith(5, { documentId: 3, pageNumber: 2, note: "Check date carefully." }); expect(mocks.deleteDocumentPdfAnnotation).toHaveBeenCalledWith(5, 7); expect(mocks.updateMyDocumentReviewAssignment).toHaveBeenCalledWith(5, 14, "inReview"); expect(mocks.revokeDocumentReviewer).toHaveBeenCalledWith(5, 14); expect(assigned.assignments).toEqual(assignments); expect(mine.assignments).toEqual([]); expect(events.events).toEqual(audit); expect(notes.annotations).toEqual(annotations); expect(saved).toEqual({ annotationId: 7 });
  });

  it("delivers reviewer assignment alerts only to the current account and passes audit date/status filters through unchanged", async () => {
    const notifications = [{ id: 81, assignmentId: 14, documentId: 3, documentName: "Income certificate", fileName: "income.pdf", mimeType: "application/pdf", schemeName: "Scholarship", ownerName: "Owner", assignmentStatus: "assigned", assignedAt: 1790000000000, createdAt: 1790000000000 }];
    const events = [{ id: 51, assignmentId: 14, actorName: "Owner", kind: "assigned", detail: "Assigned Family Reviewer.", createdAt: 1790000000000 }];
    mocks.listDocumentReviewAssignmentNotifications.mockResolvedValue(notifications); mocks.markDocumentReviewAssignmentNotificationRead.mockResolvedValue(undefined); mocks.listDocumentReviewAudit.mockResolvedValue(events);
    const caller = appRouter.createCaller(context("user"));
    const alerts = await caller.documents.reviewers.notifications(); await caller.documents.reviewers.markNotificationRead({ notificationId: 81 }); const audit = await caller.documents.reviewers.audit({ documentId: 3, startAt: 1790000000000, endAt: 1795000000000, statuses: ["assigned", "completed"] });
    expect(mocks.listDocumentReviewAssignmentNotifications).toHaveBeenCalledWith(5); expect(mocks.markDocumentReviewAssignmentNotificationRead).toHaveBeenCalledWith(5, 81); expect(mocks.listDocumentReviewAudit).toHaveBeenLastCalledWith(5, 3, { startAt: 1790000000000, endAt: 1795000000000, kinds: ["assigned", "completed"] }); expect(alerts.notifications).toEqual(notifications); expect(audit.events).toEqual(events);
  });

  it("keeps reviewer alert preferences private and saves due-date timing without creating a live scheduler in development", async () => {
    const preferences = { assignmentAlertsEnabled: false, dueDateRemindersEnabled: true, defaultReminderLeadHours: 36 };
    mocks.getDocumentReviewerAlertPreferences.mockResolvedValue(preferences); mocks.saveDocumentReviewerAlertPreferences.mockResolvedValue(preferences); mocks.setDocumentReviewAssignmentDueDate.mockResolvedValue({ assignmentId: 14, previousTaskUid: null });
    const caller = appRouter.createCaller(context("user"));
    const got = await caller.documents.reviewers.preferences.get(); const saved = await caller.documents.reviewers.preferences.save(preferences); const due = await caller.documents.reviewers.dueDates.set({ assignmentId: 14, dueAt: Date.now() + 172_800_000, reminderAt: Date.now() + 86_400_000 });
    expect(mocks.getDocumentReviewerAlertPreferences).toHaveBeenCalledWith(5); expect(mocks.saveDocumentReviewerAlertPreferences).toHaveBeenCalledWith(5, preferences); expect(mocks.setDocumentReviewAssignmentDueDate).toHaveBeenCalledWith(5, 14, expect.any(Number), expect.any(Number)); expect(got.preferences).toEqual(preferences); expect(saved.preferences).toEqual(preferences); expect(due).toEqual({ scheduled: false, deferred: true });
  });

  it("returns only unread pending family invitations for the sidebar badge count", async () => {
    const notifications = [{ id: 44, invitation: { shareId: 31, filter: { id: 12, name: "Scholarship documents", query: "income", startAt: undefined, endAt: undefined, sort: "newest" as const, createdAt: 1790000000000, updatedAt: 1790000000000 }, ownerName: "Family owner", ownerEmail: "owner@example.com", status: "pending" as const, createdAt: 1790000000000 } }];
    mocks.listFamilyFilterInvitationNotifications.mockResolvedValue(notifications);
    const result = await appRouter.createCaller(context("user")).documents.historyFilters.notifications();
    expect(mocks.listFamilyFilterInvitationNotifications).toHaveBeenCalledWith(5);
    expect(result.notifications).toHaveLength(1);
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
    const filter = { id: 12, name: "Scholarship documents", query: "income", startAt: 1790000000000, endAt: undefined, sort: "newest" as const, isDefault: false, createdAt: 1790000000000, updatedAt: 1790000000000 };
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

  it("sets or clears the default history view only for the authenticated owner", async () => {
    const defaulted = [{ id: 12, name: "Scholarship documents", query: "income", startAt: 1790000000000, endAt: undefined, sort: "newest" as const, isDefault: true, createdAt: 1790000000000, updatedAt: 1790000000000 }];
    mocks.setDefaultVerificationHistoryFilter.mockResolvedValue(defaulted);
    const caller = appRouter.createCaller(context("user"));
    const set = await caller.documents.historyFilters.setDefault({ filterId: 12 });
    const cleared = await caller.documents.historyFilters.setDefault({ filterId: null });
    expect(mocks.setDefaultVerificationHistoryFilter).toHaveBeenNthCalledWith(1, 5, 12);
    expect(mocks.setDefaultVerificationHistoryFilter).toHaveBeenNthCalledWith(2, 5, null);
    expect(set.filters).toEqual(defaulted);
    expect(cleared.filters).toEqual(defaulted);
  });

  it("shares or revokes only an owner’s saved filter, while exposing received filters only to the current account", async () => {
    const shared = [{ shareId: 21, savedFilterId: 12, recipientUserId: 8, recipientName: "Family member", recipientEmail: "family@example.com" }];
    const received = [{ shareId: 24, filter: { id: 12, name: "Scholarship documents", query: "income", startAt: undefined, endAt: undefined, sort: "newest" as const, createdAt: 1790000000000, updatedAt: 1790000000000 }, ownerName: "Family owner", ownerEmail: "owner@example.com" }];
    mocks.listSavedVerificationHistoryFilters.mockResolvedValue([]); mocks.listVerificationHistoryFilterShares.mockResolvedValue(shared); mocks.listReceivedVerificationHistoryFilters.mockResolvedValue(received); mocks.shareVerificationHistoryFilter.mockResolvedValue(shared); mocks.revokeVerificationHistoryFilterShare.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context("user"));
    const listed = await caller.documents.historyFilters.list();
    const sharedResult = await caller.documents.historyFilters.share({ filterId: 12, recipientEmail: "family@example.com" });
    const revoked = await caller.documents.historyFilters.revokeShare({ shareId: 21 });
    expect(mocks.listVerificationHistoryFilterShares).toHaveBeenCalledWith(5);
    expect(mocks.listReceivedVerificationHistoryFilters).toHaveBeenCalledWith(5);
    expect(mocks.shareVerificationHistoryFilter).toHaveBeenCalledWith(5, 12, "family@example.com");
    expect(mocks.revokeVerificationHistoryFilterShare).toHaveBeenCalledWith(5, 21);
    expect(listed).toMatchObject({ shares: shared, received });
    expect(sharedResult.shares).toEqual(shared);
    expect(revoked).toEqual({ revoked: true });
  });

  it("keeps a family filter private until its intended recipient accepts the pending invitation", async () => {
    const invitation = { shareId: 31, filter: { id: 12, name: "Scholarship documents", query: "income", startAt: undefined, endAt: undefined, sort: "newest" as const, createdAt: 1790000000000, updatedAt: 1790000000000 }, ownerName: "Family owner", ownerEmail: "owner@example.com", status: "pending" as const, createdAt: 1790000000000 };
    mocks.listSavedVerificationHistoryFilters.mockResolvedValue([]); mocks.listVerificationHistoryFilterShares.mockResolvedValue([]); mocks.listReceivedVerificationHistoryFilters.mockResolvedValue([]); mocks.listReceivedVerificationHistoryFilterInvites.mockResolvedValue([invitation]); mocks.respondToVerificationHistoryFilterInvite.mockResolvedValue({ shareId: 31, status: "accepted" });
    const caller = appRouter.createCaller(context("user"));
    const listed = await caller.documents.historyFilters.list();
    const response = await caller.documents.historyFilters.respondToInvite({ shareId: 31, decision: "accepted" });
    expect(mocks.listReceivedVerificationHistoryFilterInvites).toHaveBeenCalledWith(5);
    expect(mocks.respondToVerificationHistoryFilterInvite).toHaveBeenCalledWith(5, 31, "accepted");
    expect(listed).toMatchObject({ received: [], invitations: [invitation] });
    expect(response.invitation).toEqual({ shareId: 31, status: "accepted" });
  });

  it("lists and marks in-app family invitation alerts only for the signed-in recipient", async () => {
    const notification = { id: 44, invitation: { shareId: 31, filter: { id: 12, name: "Scholarship documents", query: "income", startAt: undefined, endAt: undefined, sort: "newest" as const, createdAt: 1790000000000, updatedAt: 1790000000000 }, ownerName: "Family owner", ownerEmail: "owner@example.com", status: "pending" as const, createdAt: 1790000000000 } };
    mocks.listFamilyFilterInvitationNotifications.mockResolvedValue([notification]); mocks.markFamilyFilterInvitationNotificationRead.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context("user"));
    const listed = await caller.documents.historyFilters.notifications();
    const marked = await caller.documents.historyFilters.markNotificationRead({ notificationId: 44 });
    expect(mocks.listFamilyFilterInvitationNotifications).toHaveBeenCalledWith(5);
    expect(mocks.markFamilyFilterInvitationNotificationRead).toHaveBeenCalledWith(5, 44);
    expect(listed.notifications).toEqual([notification]);
    expect(marked).toEqual({ marked: true });
  });
});
