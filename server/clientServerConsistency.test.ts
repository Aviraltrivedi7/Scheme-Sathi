import { describe, expect, it } from "vitest";
import { schemeCatalog, type SchemeProfileInput } from "@shared/schemeCatalog";
import { scoreScheme as serverScoreScheme } from "./schemeMatching";
import {
  schemes,
  scoreScheme as clientScoreScheme,
  states,
  toClientSchemeItem,
} from "../client/src/lib/schemes";

/**
 * The client ships its own fallback scorer and state pickers. These guards keep
 * them locked to the server source of truth so public UX can never drift.
 */
describe("client-server scheme consistency", () => {
  it("offers every state referenced by catalog eligibility rules in the client state list", () => {
    const restrictedStates = new Set<string>();
    for (const scheme of schemeCatalog) {
      if (Array.isArray(scheme.eligibility.states))
        for (const state of scheme.eligibility.states)
          restrictedStates.add(state);
    }
    expect(restrictedStates.size).toBeGreaterThan(0);
    for (const state of restrictedStates) {
      expect(
        states.includes(state),
        `catalog state "${state}" must be selectable in the client state list`
      ).toBe(true);
    }
  });

  it("derives the offline fallback catalogue from the shared reviewed source", () => {
    expect(schemes.map(scheme => scheme.id)).toEqual(
      schemeCatalog.map(scheme => scheme.id)
    );
  });

  it("scores every catalog scheme identically to the server across varied profiles", () => {
    const profiles: SchemeProfileInput[] = [
      { age: 19, state: "Assam", caste: "OBC", annualIncome: 250000, occupation: "Student", gender: "Female", isStudent: true, isFarmer: false, isDisabled: false },
      { age: 34, state: "Maharashtra", caste: "OBC", annualIncome: 180000, occupation: "Farmer", gender: "Male", isStudent: false, isFarmer: true, isDisabled: false },
      { age: 29, state: "Jammu and Kashmir", caste: "General", annualIncome: 800000, occupation: "Employee", gender: "Female", isStudent: false, isFarmer: false, isDisabled: true },
      { age: 62, state: "Ladakh", caste: "ST", annualIncome: 990000, occupation: "Retired", gender: "Male", isStudent: false, isFarmer: false, isDisabled: false },
    ];
    for (const profile of profiles) {
      for (const scheme of schemeCatalog) {
        const serverResult = serverScoreScheme(profile, scheme);
        const clientResult = clientScoreScheme(
          profile,
          toClientSchemeItem(scheme)
        );
        expect(
          clientResult.score,
          `${scheme.id} score for state ${profile.state}`
        ).toBe(serverResult.score);
        expect(
          clientResult.factors,
          `${scheme.id} factors for state ${profile.state}`
        ).toEqual(serverResult.factors);
      }
    }
  });
});
