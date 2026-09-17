import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-contract guards for standalone mode: the whole backend must remain
 * functional with only Node + MySQL, while platform mode keeps working when
 * platform variables are present. These assertions keep the two-mode wiring from
 * silently regressing.
 */
describe("standalone backend wiring", () => {
  const read = (relative: string) =>
    readFileSync(resolve(process.cwd(), relative), "utf8");

  it("boots local auth instead of OAuth when standalone", () => {
    const index = read("server/_core/index.ts");
    expect(index).toContain("STANDALONE_MODE");
    // The mode branches register exactly one of the two auth route sets.
    expect(index).toMatch(
      /if \(STANDALONE_MODE\) \{\s*registerLocalAuthRoutes\(app\);\s*\} else \{\s*registerOAuthRoutes\(app\);\s*\}/
    );
    expect(index).toContain('app.get("/api/auth/mode"');
    expect(index).toContain("attachLocalScheduler(app, port)");
    expect(index).toContain("rearmDailyExpiryScan");
  });

  it("heartbeat SDK branches into the local scheduler in standalone mode", () => {
    const heartbeat = read("server/_core/heartbeat.ts");
    expect(heartbeat).toContain("STANDALONE_MODE");
    expect(heartbeat).toContain("createLocalHeartbeatJob");
    expect(heartbeat).toContain("updateLocalHeartbeatJob");
    expect(heartbeat).toContain("deleteLocalHeartbeatJob");
  });

  it("session verification never calls the platform OAuth server for local or cron subjects", () => {
    const sdk = read("server/_core/sdk.ts");
    expect(sdk).toContain('startsWith("local:")');
    expect(sdk).toContain("if (STANDALONE_MODE) {");
    expect(sdk).toContain("cron_");
  });

  it("storage falls back to local disk and the proxy streams it", () => {
    const storage = read("server/storage.ts");
    expect(storage).toContain("STANDALONE_MODE");
    expect(storage).toContain("LOCAL_STORAGE_DIR");
    const proxy = read("server/_core/storageProxy.ts");
    expect(proxy).toContain("localKeyPath");
    expect(proxy).toContain("Invalid storage key");
  });

  it("OCR and help chat degrade honestly without an LLM endpoint", () => {
    const ocr = read("server/documentOcr.ts");
    expect(ocr).toContain("STANDALONE_MODE && !hasStandaloneLLM()");
    expect(ocr).toContain("confidence: \"low\"");
    const help = read("server/schemeHelpRoutes.ts");
    expect(help).toContain("STANDALONE_MODE && !hasStandaloneLLM()");
    expect(help).toContain("AI help is not configured");
  });

  it("reminder scheduling is not deferred in standalone dev mode", () => {
    const routers = read("server/routers.ts");
    expect(routers).toContain(
      "process.env.NODE_ENV !== \"production\" && !STANDALONE_MODE"
    );
    expect(routers).toContain("mode: STANDALONE_MODE ? (\"credentials\" as const) : (\"oauth\" as const)");
  });

  it("client resolves the login flow from the server's runtime mode endpoint", () => {
    const index = read("server/_core/index.ts");
    expect(index).toContain('app.get("/api/auth/mode"');
    expect(index).toContain("STANDALONE_MODE ? \"credentials\" : \"oauth\"");
    const clientConst = read("client/src/const.ts");
    expect(clientConst).toContain("resolveAuthMode");
    expect(clientConst).toContain('"/api/auth/mode"');
    // Build flag remains only as a fallback when the probe is unavailable.
    expect(clientConst).toContain("VITE_AUTH_MODE === \"credentials\"");
    expect(clientConst).toContain('window.location.href = target');
    expect(clientConst).toContain("isSafeReturnPath");
    const app = read("client/src/App.tsx");
    expect(app).toContain('path="/login"');
    // Login page posts to the standalone credential endpoints.
    const login = read("client/src/pages/Login.tsx");
    expect(login).toContain('"/api/auth/register"');
    expect(login).toContain('"/api/auth/login"');
  });

  it("credentials table exists in the schema and a migration matches it", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("localCredentials");
    expect(schema).toContain("local_credentials");
    const migration = read("drizzle/0028_standalone_credentials.sql");
    expect(migration).toContain("CREATE TABLE `local_credentials`");
    expect(migration).toContain("`passwordHash` varchar(255)");
    const journal = read("drizzle/meta/_journal.json");
    expect(journal).toContain("0028_standalone_credentials");
  });
});
