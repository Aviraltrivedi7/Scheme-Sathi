import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getSchemeById: vi.fn(),
  listSavedSchemeIds: vi.fn(),
  listSavedSchemeNotes: vi.fn(),
  toggleSavedScheme: vi.fn(),
  getSchemeNote: vi.fn(),
  upsertSchemeNote: vi.fn(),
  deleteSchemeNote: vi.fn(),
}));

vi.mock("./db", () => mocks);
vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob: vi.fn(), deleteHeartbeatJob: vi.fn() }));

import { appRouter } from "./routers";

function authenticatedContext(userId = 42): TrpcContext {
  return {
    user: { id: userId, openId: `scheme-note-user-${userId}`, email: null, name: "Test User", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("saved scheme personal note router", () => {
  it("reads and changes a note using only the authenticated owner id", async () => {
    mocks.getSchemeNote.mockResolvedValue({ note: "Bring income certificate", updatedAt: 123 });
    mocks.upsertSchemeNote.mockResolvedValue({ note: "Bring income certificate", updatedAt: 123 });
    const caller = appRouter.createCaller(authenticatedContext(42));

    const read = await caller.saved.getNote({ schemeId: "nsp" });
    const saved = await caller.saved.upsertNote({ schemeId: "nsp", note: "Bring income certificate" });
    await caller.saved.deleteNote({ schemeId: "nsp" });

    expect(read.note).toMatchObject({ note: "Bring income certificate" });
    expect(saved.note).toMatchObject({ note: "Bring income certificate" });
    expect(mocks.getSchemeNote).toHaveBeenCalledWith(42, "nsp");
    expect(mocks.upsertSchemeNote).toHaveBeenCalledWith(42, "nsp", "Bring income certificate");
    expect(mocks.deleteSchemeNote).toHaveBeenCalledWith(42, "nsp");
  });

  it("rejects an empty personal note before any database helper is called", async () => {
    const caller = appRouter.createCaller(authenticatedContext(77));

    await expect(caller.saved.upsertNote({ schemeId: "nsp", note: "   " })).rejects.toThrow();
    expect(mocks.upsertSchemeNote).not.toHaveBeenCalledWith(77, "nsp", "");
  });

  it("lists dashboard notes through the authenticated owner scope and bounded query", async () => {
    mocks.listSavedSchemeNotes.mockResolvedValue([{ schemeId: "nsp", schemeName: "National Scholarship Portal", note: "Check certificate", updatedAt: 123, category: "Education" }]);
    const caller = appRouter.createCaller(authenticatedContext(42));

    const result = await caller.saved.notes({ query: "certificate" });

    expect(result.notes).toHaveLength(1);
    expect(mocks.listSavedSchemeNotes).toHaveBeenCalledWith(42, "certificate");
  });
});
