/* Scheme Sathi backend contract: matching stays deterministic, explainable, and safe to test without a database. */

import type { SchemeCatalogItem, SchemeProfileInput } from "@shared/schemeCatalog";

export type MatchFactor = "age" | "income" | "category" | "work" | "state" | "gender" | "student" | "farmer" | "disability";
export type MatchedScheme = SchemeCatalogItem & { score: number; factors: MatchFactor[] };

const hasValue = (rule: string[] | "all" | undefined, value: string) => rule === undefined || rule === "all" || rule.includes(value) || rule.includes("all");

export function meetsRequiredEligibility(profile: SchemeProfileInput, scheme: SchemeCatalogItem) {
  const rule = scheme.eligibility;
  const ageMatches = (rule.ageMin === undefined || profile.age >= rule.ageMin) && (rule.ageMax === undefined || profile.age <= rule.ageMax);
  const incomeMatches = rule.incomeMax === undefined || profile.annualIncome <= rule.incomeMax;
  const workMatches = hasValue(rule.occupations, profile.occupation) || (profile.isFarmer && hasValue(rule.occupations, "Agriculture"));
  return ageMatches && incomeMatches && hasValue(rule.casteCategories, profile.caste) && workMatches && hasValue(rule.states, profile.state) && hasValue(rule.genders, profile.gender) && (rule.requiresStudent !== true || profile.isStudent) && (rule.requiresFarmer !== true || profile.isFarmer) && (rule.requiresDisability !== true || profile.isDisabled);
}

export function scoreScheme(profile: SchemeProfileInput, scheme: SchemeCatalogItem) {
  const factors: MatchFactor[] = [];
  const rule = scheme.eligibility;
  let score = 0;
  const add = (points: number, factor: MatchFactor, eligible: boolean) => { if (eligible) { score += points; factors.push(factor); } };

  add(15, "age", (rule.ageMin === undefined || profile.age >= rule.ageMin) && (rule.ageMax === undefined || profile.age <= rule.ageMax));
  add(15, "income", rule.incomeMax === undefined || profile.annualIncome <= rule.incomeMax);
  add(18, "category", hasValue(rule.casteCategories, profile.caste));
  add(22, "work", hasValue(rule.occupations, profile.occupation) || (profile.isFarmer && hasValue(rule.occupations, "Agriculture")));
  add(12, "state", hasValue(rule.states, profile.state));
  add(8, "gender", hasValue(rule.genders, profile.gender));
  add(4, "student", rule.requiresStudent !== true || profile.isStudent);
  add(3, "farmer", rule.requiresFarmer !== true || profile.isFarmer);
  add(3, "disability", rule.requiresDisability !== true || profile.isDisabled);

  return { score: Math.min(100, Math.round(score)), factors };
}

export function rankSchemes(profile: SchemeProfileInput, catalog: SchemeCatalogItem[]): MatchedScheme[] {
  return catalog.filter((scheme) => meetsRequiredEligibility(profile, scheme)).map((scheme) => ({ ...scheme, ...scoreScheme(profile, scheme) })).filter((scheme) => scheme.score >= 45).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** Scholarship checker intentionally considers only education entries that require a student profile. */
export function rankScholarshipSchemes(
  profile: SchemeProfileInput,
  catalog: SchemeCatalogItem[]
): MatchedScheme[] {
  return rankSchemes(
    { ...profile, isStudent: true, occupation: "Student" },
    catalog.filter(
      scheme =>
        scheme.category === "Education" ||
        scheme.eligibility.requiresStudent === true
    )
  );
}
