import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  listPilotFeedbackForAdmin: vi.fn(),
  updatePilotFeedbackForAdmin: vi.fn(),
  listPilotCohortInvites: vi.fn(),
  createPilotCohortInvite: vi.fn(),
  revokePilotCohortInvite: vi.fn(),
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

  it("does not expose pilot operations to ordinary users", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.admin.pilot.feedback.list()).rejects.toThrow();
    await expect(caller.admin.pilot.cohorts.list()).rejects.toThrow();
  });
});
