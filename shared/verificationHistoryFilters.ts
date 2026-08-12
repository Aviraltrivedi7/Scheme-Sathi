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
