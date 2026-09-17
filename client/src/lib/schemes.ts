/* Jan Seva Editorial reminder: keep public-service data trustworthy, scannable, bilingual, and source-aware. */

export type SchemeLevel = "Central" | "State";

export type EligibilityRule = {
  age_min?: number;
  age_max?: number;
  income_max?: number;
  caste_categories?: string[] | "all";
  occupations?: string[] | "all";
  states?: string[] | "all";
  gender?: string[] | "all";
  is_student?: boolean;
  is_farmer?: boolean;
  is_disabled?: boolean;
};

export type Scheme = {
  id: string;
  name: string;
  nameHindi: string;
  category: string;
  categoryHindi: string;
  level: SchemeLevel;
  administeringBody: string;
  benefits: string;
  benefitsHindi: string;
  eligibility: EligibilityRule;
  documents: string[];
  documentsHindi: string[];
  steps: string[];
  stepsHindi: string[];
  portalUrl: string;
  reviewed: string;
  accent: "saffron" | "emerald" | "coral" | "indigo";
  artwork: string;
  applicationDeadline?: number | null;
  deadlineLabel?: string | null;
};

export type UserProfile = {
  age: number;
  state: string;
  caste: string;
  annualIncome: number;
  occupation: string;
  gender: string;
  isStudent: boolean;
  isFarmer: boolean;
  isDisabled: boolean;
};

/* Offline fallback catalogue derives from the same reviewed shared source the server seeds, so the client can never drift from the server. */
import { schemeCatalog, type SchemeCatalogItem } from "@shared/schemeCatalog";

/** Maps the shared server-shaped catalogue entry onto the client scheme shape. */
export function toClientSchemeItem(item: SchemeCatalogItem): Scheme {
  return {
    id: item.id,
    name: item.name,
    nameHindi: item.nameHindi,
    category: item.category,
    categoryHindi: item.categoryHindi,
    level: item.level,
    administeringBody: item.administeringBody,
    benefits: item.benefits,
    benefitsHindi: item.benefitsHindi,
    eligibility: {
      age_min: item.eligibility.ageMin,
      age_max: item.eligibility.ageMax,
      income_max: item.eligibility.incomeMax,
      caste_categories: item.eligibility.casteCategories,
      occupations: item.eligibility.occupations,
      states: item.eligibility.states,
      gender: item.eligibility.genders,
      is_student: item.eligibility.requiresStudent,
      is_farmer: item.eligibility.requiresFarmer,
      is_disabled: item.eligibility.requiresDisability,
    },
    documents: item.documents,
    documentsHindi: item.documentsHindi,
    steps: item.steps,
    stepsHindi: item.stepsHindi,
    portalUrl: item.portalUrl,
    reviewed: item.reviewed,
    accent: item.accent,
    artwork: item.artwork,
    applicationDeadline: item.applicationDeadline ?? null,
    deadlineLabel: item.deadlineLabel ?? null,
  };
}

export const schemes: Scheme[] = schemeCatalog.map(toClientSchemeItem);

export const categories = [
  { key: "all", label: "All schemes", labelHi: "सभी योजनाएँ", icon: "✳" },
  { key: "Agriculture", label: "Agriculture", labelHi: "कृषि", icon: "◒" },
  { key: "Education", label: "Education", labelHi: "शिक्षा", icon: "✎" },
  { key: "Health", label: "Health", labelHi: "स्वास्थ्य", icon: "+" },
  { key: "Women & Family", label: "Women & Family", labelHi: "महिला एवं परिवार", icon: "◌" },
  { key: "Livelihood", label: "Livelihood", labelHi: "आजीविका", icon: "↗" },
  { key: "Housing", label: "Housing", labelHi: "आवास", icon: "⌂" },
];

export const states = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];
export const occupations = ["Farmer", "Student", "Unemployed", "Employee", "Business Owner", "Housewife", "Retired", "Self-Employed", "Government Employee", "Street Vendor", "Small Business", "Entrepreneur", "Other"];
export const casteCategories = ["General", "OBC", "SC", "ST", "EWS", "Other"];

export function scoreScheme(profile: UserProfile, scheme: Scheme) {
  const rule = scheme.eligibility;
  const factors: string[] = [];
  let score = 0;
  const add = (points: number, factor: string, matched: boolean) => {
    if (matched) {
      score += points;
      factors.push(factor);
    }
  };
  add(15, "age", rule.age_min === undefined || ((profile.age >= rule.age_min) && (rule.age_max === undefined || profile.age <= rule.age_max)));
  add(15, "income", rule.income_max === undefined || profile.annualIncome <= rule.income_max);
  add(18, "category", rule.caste_categories === undefined || rule.caste_categories === "all" || rule.caste_categories.includes(profile.caste) || rule.caste_categories.includes("all"));
  add(22, "work", rule.occupations === undefined || rule.occupations === "all" || rule.occupations.includes(profile.occupation) || (profile.isFarmer && rule.occupations.includes("Agriculture")));
  add(12, "state", rule.states === undefined || rule.states === "all" || rule.states.includes(profile.state));
  add(8, "gender", rule.gender === undefined || rule.gender === "all" || rule.gender.includes(profile.gender) || rule.gender.includes("all"));
  add(4, "student", rule.is_student !== true || profile.isStudent);
  add(3, "farmer", rule.is_farmer !== true || profile.isFarmer);
  add(3, "disability", rule.is_disabled !== true || profile.isDisabled);
  return { score: Math.min(100, Math.round(score)), factors };
}

export type ScoreBreakdownItem = { key: string; points: number; matched: boolean; english: string; hindi: string };
export function getScoreBreakdown(profile: UserProfile, scheme: Scheme): ScoreBreakdownItem[] {
  const rule = scheme.eligibility;
  const ageMatched = rule.age_min === undefined || (profile.age >= rule.age_min && (rule.age_max === undefined || profile.age <= rule.age_max));
  const incomeMatched = rule.income_max === undefined || profile.annualIncome <= rule.income_max;
  const categoryMatched = rule.caste_categories === undefined || rule.caste_categories === "all" || rule.caste_categories.includes(profile.caste) || rule.caste_categories.includes("all");
  const workMatched = rule.occupations === undefined || rule.occupations === "all" || rule.occupations.includes(profile.occupation) || (profile.isFarmer && rule.occupations.includes("Agriculture"));
  const stateMatched = rule.states === undefined || rule.states === "all" || rule.states.includes(profile.state);
  const genderMatched = rule.gender === undefined || rule.gender === "all" || rule.gender.includes(profile.gender) || rule.gender.includes("all");
  const ranges = (minimum?: number, maximum?: number) => minimum === undefined ? "any age" : maximum === undefined ? `age ${minimum}+` : `ages ${minimum}–${maximum}`;
  return [
    { key: "age", points: 15, matched: ageMatched, english: ageMatched ? `Your age (${profile.age}) fits the scheme’s ${ranges(rule.age_min, rule.age_max)} criteria.` : `Your age (${profile.age}) does not fit the scheme’s ${ranges(rule.age_min, rule.age_max)} criteria.`, hindi: ageMatched ? `आपकी आयु (${profile.age}) योजना की ${ranges(rule.age_min, rule.age_max)} पात्रता में आती है।` : `आपकी आयु (${profile.age}) योजना की ${ranges(rule.age_min, rule.age_max)} पात्रता में नहीं आती है।` },
    { key: "income", points: 15, matched: incomeMatched, english: incomeMatched ? "Your stated household income fits this scheme’s income criterion." : "Your stated household income is above this scheme’s listed income criterion.", hindi: incomeMatched ? "आपकी बताई घरेलू आय योजना के आय मानदंड में आती है।" : "आपकी बताई घरेलू आय योजना के सूचीबद्ध आय मानदंड से ऊपर है।" },
    { key: "category", points: 18, matched: categoryMatched, english: categoryMatched ? "Your social category is supported by this eligibility rule." : "Your selected social category did not add points under this eligibility rule.", hindi: categoryMatched ? "आपकी सामाजिक श्रेणी इस पात्रता नियम में शामिल है।" : "आपकी चुनी सामाजिक श्रेणी ने इस पात्रता नियम में अंक नहीं जोड़े।" },
    { key: "work", points: 22, matched: workMatched, english: workMatched ? "Your work profile matches the scheme’s supported occupation rule." : "Your work profile did not match this scheme’s listed occupation rule.", hindi: workMatched ? "आपका काम का प्रोफाइल योजना के समर्थित व्यवसाय नियम से मिलता है।" : "आपका काम का प्रोफाइल योजना के सूचीबद्ध व्यवसाय नियम से नहीं मिला।" },
    { key: "state", points: 12, matched: stateMatched, english: stateMatched ? "The scheme is available for your selected state or is open nationally." : "This scheme’s listed state coverage did not match your selected state.", hindi: stateMatched ? "योजना आपके चुने राज्य में उपलब्ध है या राष्ट्रीय स्तर पर खुली है।" : "योजना की सूचीबद्ध राज्य कवरेज आपके चुने राज्य से नहीं मिली।" },
    { key: "gender", points: 8, matched: genderMatched, english: genderMatched ? "Your selected gender fits this eligibility rule or the rule is open to all." : "Your selected gender did not add points under this eligibility rule.", hindi: genderMatched ? "आपका चुना लिंग इस पात्रता नियम में आता है या नियम सभी के लिए खुला है।" : "आपके चुने लिंग ने इस पात्रता नियम में अंक नहीं जोड़े।" },
    { key: "student", points: 4, matched: rule.is_student !== true || profile.isStudent, english: rule.is_student !== true || profile.isStudent ? "Student status fits this rule or is not required." : "This scheme requires student status, which is not selected in your profile.", hindi: rule.is_student !== true || profile.isStudent ? "छात्र स्थिति इस नियम से मेल खाती है या आवश्यक नहीं है।" : "इस योजना में छात्र स्थिति चाहिए, जो आपके प्रोफाइल में चयनित नहीं है।" },
    { key: "farmer", points: 3, matched: rule.is_farmer !== true || profile.isFarmer, english: rule.is_farmer !== true || profile.isFarmer ? "Farmer status fits this rule or is not required." : "This scheme requires farmer status, which is not selected in your profile.", hindi: rule.is_farmer !== true || profile.isFarmer ? "किसान स्थिति इस नियम से मेल खाती है या आवश्यक नहीं है।" : "इस योजना में किसान स्थिति चाहिए, जो आपके प्रोफाइल में चयनित नहीं है।" },
    { key: "disability", points: 3, matched: rule.is_disabled !== true || profile.isDisabled, english: rule.is_disabled !== true || profile.isDisabled ? "Disability status fits this rule or is not required." : "This scheme requires disability status, which is not selected in your profile.", hindi: rule.is_disabled !== true || profile.isDisabled ? "दिव्यांग स्थिति इस नियम से मेल खाती है या आवश्यक नहीं है।" : "इस योजना में दिव्यांग स्थिति चाहिए, जो आपके प्रोफाइल में चयनित नहीं है।" },
  ];
}

export function getDeadlineUrgency(deadline?: number | null, now = Date.now()) {
  if (!deadline) return { state: "none" as const, days: null };
  if (deadline < now) return { state: "closed" as const, days: Math.floor((deadline - now) / 86_400_000) };
  const days = Math.ceil((deadline - now) / 86_400_000);
  if (days <= 30) return { state: "closingSoon" as const, days };
  return { state: "open" as const, days };
}

export function getTier(score: number) {
  if (score >= 85) return { label: "Strong match", labelHi: "बहुत अच्छा मिलान", tone: "strong" };
  if (score >= 70) return { label: "Good match", labelHi: "अच्छा मिलान", tone: "good" };
  return { label: "Worth checking", labelHi: "जाँचने योग्य", tone: "check" };
}

export const factorLabels: Record<string, [string, string]> = {
  age: ["Age fits", "आयु अनुकूल है"],
  income: ["Income criteria", "आय मानदंड"],
  category: ["Category supported", "श्रेणी समर्थित है"],
  work: ["Work profile", "काम का प्रोफाइल"],
  state: ["State coverage", "राज्य में लागू"],
  gender: ["Gender criteria", "लिंग मानदंड"],
  student: ["Student status", "छात्र स्थिति"],
  farmer: ["Farmer status", "किसान स्थिति"],
  disability: ["Disability support", "दिव्यांग सहायता"],
};
