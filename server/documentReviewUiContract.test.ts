import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("review collaboration and PDF note UI contracts", () => {
  it("contains an unread sidebar invitation badge plus private page-note and audit controls", () => {
    const layout = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
    const workspace = readFileSync(resolve(process.cwd(), "client/src/components/DocumentReviewWorkspace.tsx"), "utf8");
    expect(layout).toContain("pendingInvitationCount");
    expect(layout).toContain("Family invitations");
    expect(layout).toContain("family-invitations");
    expect(workspace).toContain("PRIVATE NOTES");
    expect(workspace).toContain("onPageChange");
    expect(workspace).toContain("Save private note");
    expect(workspace).toContain("Review audit trail");
    expect(workspace).toContain("Assign secure review");
    expect(workspace).toContain("REVIEW ALERTS");
    expect(workspace).toContain("Event status");
    expect(workspace).toContain("Clear filters");
    expect(layout).toContain("Review alerts");
  });
});
