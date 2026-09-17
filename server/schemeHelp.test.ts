import { describe, expect, it } from "vitest";
import { buildSchemeHelpMessages, isValidSchemeHelpInput } from "./schemeHelp";

describe("Scheme Sathi AI help context", () => {
  it("builds a bounded private context with the selected scheme and no persistence request", () => {
    const messages = buildSchemeHelpMessages({ question: "Which documents should I keep ready?", language: "en", profile: { age: 28, state: "Delhi", annualIncome: 250000, occupation: "Farmer" }, scheme: { name: "PM-KISAN", benefits: "Income support", documents: ["Land record"], steps: ["Register"], applicationDeadline: null, portalUrl: "https://pmkisan.gov.in", factors: ["occupation"] } });
    expect(messages).toHaveLength(2); expect(String(messages[0].content)).toContain("Never claim a user is definitely eligible"); expect(String(messages[1].content)).toContain("PM-KISAN"); expect(String(messages[1].content)).toContain("Which documents should I keep ready?"); expect(String(messages[1].content)).not.toContain("Aadhaar");
  });

  it("accepts only short bilingual help questions", () => {
    expect(isValidSchemeHelpInput({ question: "मुझे कहाँ से शुरू करना चाहिए?", language: "hi" })).toBe(true);
    expect(isValidSchemeHelpInput({ question: "", language: "en" })).toBe(false);
    expect(isValidSchemeHelpInput({ question: "x".repeat(801), language: "en" })).toBe(false);
  });
});
