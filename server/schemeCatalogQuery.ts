import type { SchemeCatalogItem } from "@shared/schemeCatalog";

export type SchemeCatalogListFilters = {
  category?: string;
  level?: "Central" | "State";
  state?: string;
  deadline?: "announced" | "closingSoon" | "openEnded";
  administeringBody?: string;
  verificationStatus?: "officialDirectory" | "eligibilityVerified" | "officialNotice";
  sort?: "name" | "category" | "deadline" | "reviewed" | "provider";
  query?: string;
};

/** Filters source-aware catalog rows without mutating the catalog input. */
export function filterSchemeCatalog(
  catalog: SchemeCatalogItem[],
  filters?: SchemeCatalogListFilters,
  now = Date.now()
) {
  const query = filters?.query?.trim().toLowerCase();
  const closingSoon = now + 90 * 24 * 60 * 60 * 1000;
  const filtered = catalog.filter(scheme => {
    const matchesCategory =
      !filters?.category ||
      filters.category === "all" ||
      scheme.category === filters.category;
    const matchesLevel = !filters?.level || scheme.level === filters.level;
    const matchesAdministeringBody =
      !filters?.administeringBody ||
      scheme.administeringBody.toLowerCase() ===
        filters.administeringBody.trim().toLowerCase();
    const matchesVerificationStatus =
      !filters?.verificationStatus ||
      scheme.verificationStatus === filters.verificationStatus;
    const stateRule = scheme.eligibility.states;
    const matchesState =
      !filters?.state ||
      filters.state === "all" ||
      stateRule === undefined ||
      stateRule === "all" ||
      stateRule.includes(filters.state);
    const matchesDeadline =
      !filters?.deadline ||
      (filters.deadline === "announced" && !!scheme.applicationDeadline) ||
      (filters.deadline === "openEnded" && !scheme.applicationDeadline) ||
      (filters.deadline === "closingSoon" &&
        !!scheme.applicationDeadline &&
        scheme.applicationDeadline >= now &&
        scheme.applicationDeadline <= closingSoon);
    const searchable =
      `${scheme.name} ${scheme.nameHindi} ${scheme.benefits} ${scheme.category} ${scheme.administeringBody}`.toLowerCase();
    return (
      matchesCategory &&
      matchesLevel &&
      matchesAdministeringBody &&
      matchesVerificationStatus &&
      matchesState &&
      matchesDeadline &&
      (!query || searchable.includes(query))
    );
  });

  if (filters?.sort === "name")
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  if (filters?.sort === "category")
    return [...filtered].sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
  if (filters?.sort === "deadline")
    return [...filtered].sort(
      (a, b) =>
        (a.applicationDeadline ?? Number.MAX_SAFE_INTEGER) -
        (b.applicationDeadline ?? Number.MAX_SAFE_INTEGER)
    );
  if (filters?.sort === "reviewed")
    return [...filtered].sort((a, b) => b.reviewed.localeCompare(a.reviewed));
  if (filters?.sort === "provider")
    return [...filtered].sort(
      (a, b) =>
        a.administeringBody.localeCompare(b.administeringBody) ||
        a.name.localeCompare(b.name)
    );
  return filtered;
}
