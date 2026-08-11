import { describe, expect, it } from "vitest";
import { expiryNoticeKind, getDocumentExpiryState } from "./documentExpiry";

describe("document expiry rules", () => {
  const now = Date.UTC(2026, 7, 12, 0, 0, 0);
  it("classifies valid, expiring, expired, and unknown documents", () => {
    expect(getDocumentExpiryState(null, now)).toBe("unknown");
    expect(getDocumentExpiryState(now + 20 * 86_400_000, now)).toBe("valid");
    expect(getDocumentExpiryState(now + 14 * 86_400_000, now)).toBe("expiringSoon");
    expect(getDocumentExpiryState(now - 1, now)).toBe("expired");
  });

  it("emits notifications only for documents needing attention", () => {
    expect(expiryNoticeKind("valid")).toBeNull();
    expect(expiryNoticeKind("expiringSoon")).toBe("expiringSoon");
    expect(expiryNoticeKind("expired")).toBe("expired");
  });
});
