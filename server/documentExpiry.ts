export type DocumentExpiryState = "valid" | "expiringSoon" | "expired" | "unknown";

export function getDocumentExpiryState(expiresAt: number | null | undefined, now = Date.now(), noticeWindowDays = 14): DocumentExpiryState {
  if (!expiresAt) return "unknown";
  if (expiresAt < now) return "expired";
  if (expiresAt <= now + noticeWindowDays * 86_400_000) return "expiringSoon";
  return "valid";
}

export function expiryNoticeKind(state: DocumentExpiryState) {
  if (state === "expired") return "expired" as const;
  if (state === "expiringSoon") return "expiringSoon" as const;
  return null;
}
