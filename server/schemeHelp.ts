import type { Message } from "./_core/llm";

type HelpProfile = { age?: number; state?: string; caste?: string; annualIncome?: number; occupation?: string; gender?: string; isStudent?: boolean; isFarmer?: boolean; isDisabled?: boolean };
type HelpScheme = { name?: string; nameHindi?: string; benefits?: string; benefitsHindi?: string; documents?: string[]; steps?: string[]; applicationDeadline?: number | null; deadlineLabel?: string | null; portalUrl?: string; factors?: string[] };

export function buildSchemeHelpMessages(input: { question: string; language: "en" | "hi"; profile?: HelpProfile; scheme?: HelpScheme | null }): Message[] {
  const profile = input.profile ?? {};
  const context = {
    language: input.language === "hi" ? "Hindi" : "English",
    profile: { age: profile.age ?? null, state: profile.state || null, caste: profile.caste || null, annualIncome: profile.annualIncome ?? null, occupation: profile.occupation || null, gender: profile.gender || null, isStudent: Boolean(profile.isStudent), isFarmer: Boolean(profile.isFarmer), isDisabled: Boolean(profile.isDisabled) },
    selectedScheme: input.scheme ? { name: input.scheme.name ?? null, nameHindi: input.scheme.nameHindi ?? null, benefits: input.scheme.benefits ?? null, benefitsHindi: input.scheme.benefitsHindi ?? null, documents: input.scheme.documents ?? [], steps: input.scheme.steps ?? [], deadline: input.scheme.applicationDeadline ? new Date(input.scheme.applicationDeadline).toISOString().slice(0, 10) : null, deadlineLabel: input.scheme.deadlineLabel ?? null, portalUrl: input.scheme.portalUrl ?? null, matchingFactors: input.scheme.factors ?? [] } : null,
  };
  const languageInstruction = input.language === "hi" ? "Reply primarily in clear, respectful Hindi (Devanagari), with English terms only where naturally useful." : "Reply in clear, respectful English.";
  return [
    { role: "system", content: `You are Scheme Sathi, a cautious government-scheme guidance assistant for India. ${languageInstruction} Use only the provided profile and selected scheme context. Give concise, practical next steps, explain uncertainty, and clearly say when official portal verification is needed. Never claim a user is definitely eligible, never invent benefit amounts, deadlines, documents, or official rules, and never request Aadhaar, bank details, passwords, OTPs, or uploaded documents. This is informational guidance, not legal or official eligibility advice.` },
    { role: "user", content: `Context (private, session-only):\n${JSON.stringify(context)}\n\nQuestion: ${input.question.trim()}` },
  ];
}

export function isValidSchemeHelpInput(input: unknown): input is { question: string; language: "en" | "hi"; profile?: HelpProfile; scheme?: HelpScheme | null } {
  if (!input || typeof input !== "object") return false;
  const value = input as { question?: unknown; language?: unknown };
  return typeof value.question === "string" && value.question.trim().length > 0 && value.question.trim().length <= 800 && (value.language === "en" || value.language === "hi");
}
