import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  listPilotFeedbackForAdmin: vi.fn(),
  updatePilotFeedbackForAdmin: vi.fn(),
  listPilotCohortInvites: vi.fn(),
  listPilotCohortConversionStats: vi.fn(),
  listPilotCohortMonthlyConversionTrend: vi.fn(),
  listPilotDashboardViews: vi.fn(),
  savePilotDashboardView: vi.fn(),
  deletePilotDashboardView: vi.fn(),
  setPilotDashboardViewPinned: vi.fn(),
  reorderPinnedPilotDashboardViews: vi.fn(),
  renamePilotDashboardViewFolder: vi.fn(),
  movePilotDashboardViewsToFolder: vi.fn(),
  duplicatePilotDashboardView: vi.fn(),
  createPilotCohortInvite: vi.fn(),
  revokePilotCohortInvite: vi.fn(),
  recordPilotCohortSignup: vi.fn(),
  recordPilotCohortVisit: vi.fn(),
}));

vi.mock("./db", () => mocks);
vi.mock("./_core/heartbeat", () => ({
  createHeartbeatJob: vi.fn(),
  deleteHeartbeatJob: vi.fn(),
}));

import { appRouter } from "./routers";

function context(role: "user" | "admin"): TrpcContext {
  return {
    user: {
      id: 9,
      openId: `pilot-${role}`,
      email: null,
      name: "Pilot Tester",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("admin pilot inbox and cohort invites", () => {
  it("lists and updates feedback only through the admin caller", async () => {
    mocks.listPilotFeedbackForAdmin.mockResolvedValue([{ id: 4, status: "new" }]);
    const caller = appRouter.createCaller(context("admin"));

    const listed = await caller.admin.pilot.feedback.list({
      status: "new",
      query: "certificate",
    });
    await caller.admin.pilot.feedback.update({
      feedbackId: 4,
      status: "followUp",
      adminNote: "Contact the scholarship cell",
    });

    expect(listed.feedback).toHaveLength(1);
    expect(mocks.listPilotFeedbackForAdmin).toHaveBeenCalledWith({
      status: "new",
      query: "certificate",
    });
    expect(mocks.updatePilotFeedbackForAdmin).toHaveBeenCalledWith(4, {
      feedbackId: 4,
      status: "followUp",
      adminNote: "Contact the scholarship cell",
    });
  });

  it("creates and revokes bounded cohort links using the authenticated admin identity", async () => {
    mocks.createPilotCohortInvite.mockResolvedValue({ id: 8, code: "COHORT8" });
    mocks.listPilotCohortInvites.mockResolvedValue([{ id: 8, active: true }]);
    const caller = appRouter.createCaller(context("admin"));

    const created = await caller.admin.pilot.cohorts.create({
      cohortName: "Pune College Cell",
      cohortType: "college",
      maxUses: 50,
    });
    const listed = await caller.admin.pilot.cohorts.list();
    await caller.admin.pilot.cohorts.revoke({ inviteId: 8 });

    expect(created.invite).toEqual({ id: 8, code: "COHORT8" });
    expect(listed.invites).toHaveLength(1);
    expect(mocks.createPilotCohortInvite).toHaveBeenCalledWith(9, {
      cohortName: "Pune College Cell",
      cohortType: "college",
      maxUses: 50,
    });
    expect(mocks.revokePilotCohortInvite).toHaveBeenCalledWith(8);
  });

  it("keeps conversion reporting aggregate-only and attributes an account through the protected caller", async () => {
    mocks.listPilotCohortConversionStats.mockResolvedValue([
      {
        inviteId: 8,
        cohortName: "Pune College Cell",
        linkVisits: 20,
        feedbackSubmissions: 7,
        accountSignups: 4,
        signupRate: 20,
      },
    ]);
    mocks.listPilotCohortMonthlyConversionTrend.mockResolvedValue([
      { month: "2026-08", linkVisits: 20, feedbackRate: 35, signupRate: 20 },
    ]);
    mocks.recordPilotCohortVisit.mockResolvedValue({ recorded: true, reason: null });
    mocks.recordPilotCohortSignup.mockResolvedValue({
      attributed: true,
      reason: null,
      cohortName: "Pune College Cell",
    });

    const admin = appRouter.createCaller(context("admin"));
    const user = appRouter.createCaller(context("user"));
    const range = { startAt: 1_700_000_000_000, endAt: 1_700_086_400_000 };
    const funnelInput = { ...range, cohortType: "college" as const };
    const trendInput = { ...funnelInput, period: "quarter" as const };
    const stats = await admin.admin.pilot.cohorts.conversionStats(funnelInput);
    const trend = await admin.admin.pilot.cohorts.monthlyTrend(trendInput);
    await user.pilot.trackCohortVisit({
      code: "COHORT88",
      visitorToken: "0f8434ec-b7ee-4f49-9408-60b2266c4f70",
    });
    const attribution = await user.pilot.recordCohortSignup({ code: "COHORT88" });

    expect(stats.cohorts).toEqual([
      expect.objectContaining({
        cohortName: "Pune College Cell",
        accountSignups: 4,
      }),
    ]);
    expect(mocks.listPilotCohortConversionStats).toHaveBeenCalledWith(funnelInput);
    expect(mocks.listPilotCohortMonthlyConversionTrend).toHaveBeenCalledWith(trendInput);
    expect(trend.months).toEqual([
      expect.objectContaining({ month: "2026-08", signupRate: 20 }),
    ]);
    expect(mocks.recordPilotCohortVisit).toHaveBeenCalledWith(
      "COHORT88",
      "0f8434ec-b7ee-4f49-9408-60b2266c4f70"
    );
    expect(mocks.recordPilotCohortSignup).toHaveBeenCalledWith(9, "COHORT88");
    expect(attribution).toEqual(
      expect.objectContaining({ attributed: true, cohortName: "Pune College Cell" })
    );
  });

  it("does not expose pilot operations to ordinary users", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.admin.pilot.feedback.list()).rejects.toThrow();
    await expect(caller.admin.pilot.cohorts.list()).rejects.toThrow();
    await expect(caller.admin.pilot.cohorts.conversionStats()).rejects.toThrow();
    await expect(caller.admin.pilot.cohorts.monthlyTrend()).rejects.toThrow();
    await expect(caller.admin.pilot.views.list()).rejects.toThrow();
    await expect(caller.admin.pilot.views.renameFolder({ fromFolder: "Review", toFolder: "Archive" })).rejects.toThrow();
    await expect(caller.admin.pilot.views.moveToFolder({ viewIds: [3], folder: "Review" })).rejects.toThrow();
    await expect(caller.admin.pilot.views.duplicate({ viewId: 3 })).rejects.toThrow();
  });

  it("keeps named dashboard views private to the authenticated administrator", async () => {
    mocks.listPilotDashboardViews.mockResolvedValue([{ id: 3, name: "College Q2", filters: { from: "2026-04-01", to: "2026-06-30", segment: "college", view: "quarter" } }]);
    mocks.savePilotDashboardView.mockResolvedValue({ id: 3, name: "College Q2", folder: "Quarterly reviews" });
    const caller = appRouter.createCaller(context("admin"));
    const filters = { from: "2026-04-01", to: "2026-06-30", segment: "college" as const, view: "quarter" as const };
    const listed = await caller.admin.pilot.views.list();
    await caller.admin.pilot.views.save({ name: "College Q2", filters, folder: "Quarterly reviews" });
    await caller.admin.pilot.views.delete({ viewId: 3 });
    expect(listed.views).toHaveLength(1);
    expect(mocks.listPilotDashboardViews).toHaveBeenCalledWith(9);
    expect(mocks.savePilotDashboardView).toHaveBeenCalledWith(9, "College Q2", filters, "Quarterly reviews");
    expect(mocks.deletePilotDashboardView).toHaveBeenCalledWith(9, 3);
  });

  it("pins a named dashboard view only for the authenticated administrator", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await caller.admin.pilot.views.setPinned({ viewId: 3, isPinned: true });
    expect(mocks.setPilotDashboardViewPinned).toHaveBeenCalledWith(9, 3, true);
  });

  it("reorders only the authenticated administrator's complete pinned-view sequence", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await caller.admin.pilot.views.reorderPinned({ viewIds: [11, 4, 8] });
    expect(mocks.reorderPinnedPilotDashboardViews).toHaveBeenCalledWith(9, [11, 4, 8]);
  });

  it("surfaces pinned-order validation and keeps the reorder route administrator-only", async () => {
    const admin = appRouter.createCaller(context("admin"));
    const user = appRouter.createCaller(context("user"));
    mocks.reorderPinnedPilotDashboardViews.mockRejectedValueOnce(
      new Error("Pinned view order must include every one of your pinned views exactly once.")
    );
    await expect(admin.admin.pilot.views.reorderPinned({ viewIds: [3, 3] })).rejects.toThrow(
      "Pinned view order must include every one of your pinned views exactly once."
    );
    await expect(user.admin.pilot.views.reorderPinned({ viewIds: [3] })).rejects.toThrow();
  });

  it("renames folders and bulk-moves saved views through the authenticated administrator identity", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await caller.admin.pilot.views.renameFolder({ fromFolder: "Quarterly reviews", toFolder: "Leadership review" });
    await caller.admin.pilot.views.moveToFolder({ viewIds: [3, 8], folder: "Leadership review" });
    await caller.admin.pilot.views.moveToFolder({ viewIds: [8], folder: null });
    expect(mocks.renamePilotDashboardViewFolder).toHaveBeenCalledWith(9, "Quarterly reviews", "Leadership review");
    expect(mocks.movePilotDashboardViewsToFolder).toHaveBeenNthCalledWith(1, 9, [3, 8], "Leadership review");
    expect(mocks.movePilotDashboardViewsToFolder).toHaveBeenNthCalledWith(2, 9, [8], null);
  });

  it("duplicates only the current administrator's selected saved view", async () => {
    mocks.duplicatePilotDashboardView.mockResolvedValue({ id: 12, name: "College Q2 copy", folder: "Leadership review" });
    const caller = appRouter.createCaller(context("admin"));
    const result = await caller.admin.pilot.views.duplicate({ viewId: 3 });
    expect(mocks.duplicatePilotDashboardView).toHaveBeenCalledWith(9, 3);
    expect(result.view).toEqual(expect.objectContaining({ id: 12, name: "College Q2 copy" }));
  });

  it("rejects an invalid cohort report date range before it reaches aggregation", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(
      caller.admin.pilot.cohorts.conversionStats({
        startAt: 1_700_086_400_000,
        endAt: 1_700_000_000_000,
      })
    ).rejects.toThrow("Report start date must be before the end date.");
    await expect(
      caller.admin.pilot.cohorts.monthlyTrend({
        startAt: 1_700_086_400_000,
        endAt: 1_700_000_000_000,
      })
    ).rejects.toThrow("Report start date must be before the end date.");
  });
});
