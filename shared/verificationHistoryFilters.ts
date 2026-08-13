export type VerificationHistorySort = "newest" | "oldest";

export type VerificationHistoryFilterPresetInput = {
  name: string;
  query: string;
  startAt?: number;
  endAt?: number;
  sort: VerificationHistorySort;
};

export type SavedVerificationHistoryFilter = VerificationHistoryFilterPresetInput & {
  id: number;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SharedVerificationHistoryFilter = {
  shareId: number;
  filter: Omit<SavedVerificationHistoryFilter, "isDefault">;
  ownerName: string | null;
  ownerEmail: string | null;
};

export type FamilyFilterInviteStatus = "pending" | "accepted" | "declined";
export type VerificationHistoryFilterShareRecipient = { shareId: number; savedFilterId: number; recipientUserId: number; recipientName: string | null; recipientEmail: string | null; status: FamilyFilterInviteStatus; createdAt: number; respondedAt: number | null };
export type ReceivedVerificationHistoryFilterInvite = SharedVerificationHistoryFilter & { status: "pending"; createdAt: number };
