import { describe, expect, it } from "vitest";
import { buildDocumentActivityInsert, buildOcrApprovalUpdate, toDocumentTimeline } from "./documentActivity";

describe("document activity persistence contract", () => {
  it("constructs bounded writes for every supported document action", () => {
    const kinds = ["uploaded", "reuploaded", "expiryUpdated", "ocrStarted", "ocrCompleted", "ocrFailed", "userVerified"] as const;
    for (const kind of kinds) expect(buildDocumentActivityInsert(44, kind, "event detail")).toMatchObject({ applicationDocumentId: 44, kind, detail: "event detail" });
  });

  it("returns newest document activity first for the dashboard timeline", () => {
    const timeline = toDocumentTimeline([{ id: 1, kind: "uploaded" as const, detail: "Initial upload", createdAt: new Date("2026-08-01") }, { id: 2, kind: "ocrCompleted" as const, detail: "OCR done", createdAt: new Date("2026-08-02") }, { id: 3, kind: "userVerified" as const, detail: "User confirmed", createdAt: new Date("2026-08-03") }]);
    expect(timeline.map((event) => event.kind)).toEqual(["userVerified", "ocrCompleted", "uploaded"]);
  });

  it("builds a durable OCR approval update with a verification timestamp", () => {
    const at = new Date("2026-08-12T00:00:00.000Z");
    expect(buildOcrApprovalUpdate(at)).toEqual({ userVerifiedAt: at, updatedAt: at });
  });
});
