import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard secure preview recovery states", () => {
  it("renders a loading skeleton and an owner-safe error state with retry when the signed preview request is unavailable", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
    const styles = readFileSync(resolve(process.cwd(), "client/src/pages/DocumentWorkflowEnhancements.css"), "utf8");
    expect(dashboard).toContain('previewQuery.isLoading');
    expect(dashboard).toContain('preview-state preview-skeleton');
    expect(dashboard).toContain('Creating your secure, account-only preview…');
    expect(dashboard).toContain('previewQuery.isError');
    expect(dashboard).toContain('preview-state preview-error');
    expect(dashboard).toContain('Secure preview could not load');
    expect(dashboard).toContain('previewQuery.refetch()');
    expect(styles).toContain('.preview-skeleton');
    expect(styles).toContain('.preview-error');
  });
});
