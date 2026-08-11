import { describe, expect, it } from "vitest";
import { schemeCatalog, type SchemeProfileInput } from "@shared/schemeCatalog";
import { rankSchemes, scoreScheme } from "./schemeMatching";

const farmerProfile: SchemeProfileInput = { age: 34, state: "Maharashtra", caste: "OBC", annualIncome: 180000, occupation: "Farmer", gender: "Male", isStudent: false, isFarmer: true, isDisabled: false };

describe("Scheme Sathi matching", () => {
  it("ranks an eligible farmer scheme as a strong match with explanations", () => {
    const pmKisan = schemeCatalog.find((scheme) => scheme.id === "pmkisan");
    expect(pmKisan).toBeDefined();
    const result = scoreScheme(farmerProfile, pmKisan!);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.factors).toContain("farmer");
    expect(result.factors).toContain("work");
  });

  it("keeps state-specific schemes out when the profile state does not qualify", () => {
    const matches = rankSchemes(farmerProfile, schemeCatalog);
    expect(matches.find((scheme) => scheme.id === "up-kanya")).toBeUndefined();
  });
});
