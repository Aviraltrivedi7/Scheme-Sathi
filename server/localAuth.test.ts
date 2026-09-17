import { describe, expect, it } from "vitest";
import { validateCredentialInput } from "./_core/localAuth";

describe("standalone credential auth", () => {
  it("accepts a valid register payload", () => {
    expect(
      validateCredentialInput({
        name: "Aarti Sharma",
        email: "aarti@example.com",
        password: "correct-horse-battery",
      })
    ).toBe(true);
  });

  it("rejects short names, bad emails, and weak passwords", () => {
    expect(
      validateCredentialInput({ name: "A", email: "a@b.co", password: "longenough123" })
    ).toBe(false);
    expect(
      validateCredentialInput({ name: "Aarti", email: "not-an-email", password: "longenough123" })
    ).toBe(false);
    expect(
      validateCredentialInput({ name: "Aarti", email: "a@b.co", password: "short" })
    ).toBe(false);
    expect(validateCredentialInput(null)).toBe(false);
    expect(validateCredentialInput("nope")).toBe(false);
  });
});
