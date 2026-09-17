import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-contract guards for the production-hardening round. These assert the
 * wiring exists in the served files, so a refactor that silently drops a
 * security control fails CI instead of reaching production.
 */
const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("hardening wiring", () => {
  it("standalone cookies use SameSite=lax and follow the request protocol", () => {
    const cookies = read("server/_core/cookies.ts");
    // Browsers silently reject SameSite=None without Secure on plain HTTP,
    // which would break every LAN deployment that is not behind TLS.
    expect(cookies).toContain('sameSite: "lax"');
    // Secure rides along on TLS requests (direct or proxied) instead of being
    // hardcoded off, and stays off for plain HTTP so LAN logins still work.
    expect(cookies).toContain("secure: isSecureRequest(req)");
    // Platform mode keeps its original None + Secure cookie policy.
    expect(cookies).toContain('sameSite: "none"');
  });

  it("register and login are brute-force rate limited and reject weak passwords", () => {
    const auth = read("server/_core/localAuth.ts");
    expect(auth).toContain("REGISTER_LIMIT");
    expect(auth).toContain("LOGIN_LIMIT");
    expect(auth).toContain("WEAK_PASSWORDS");
    expect(auth).toContain("consumeRateLimit(REGISTER_LIMIT");
    expect(auth).toContain("consumeRateLimit(LOGIN_LIMIT");
    // Uniform 429 so the response never reveals which limit fired.
    expect(auth).toContain("tooManyAttempts");
    expect(auth).toContain("res.status(429)");
    expect(auth).toContain("isWeakPassword(password)");
    expect(auth).toMatch(/password\.trim\(\)\.toLowerCase\(\)/);
  });

  it("the server sends hardening response headers", () => {
    const index = read("server/_core/index.ts");
    expect(index).toContain('"X-Content-Type-Options": "nosniff"');
    expect(index).toContain('"X-Frame-Options": "SAMEORIGIN"');
    expect(index).toContain('"Referrer-Policy": "same-origin"');
    // Headers must be applied before any route can respond.
    expect(
      index.indexOf('"X-Content-Type-Options": "nosniff"')
    ).toBeLessThan(index.indexOf("registerStorageProxy(app)"));
  });

  it("exposes a /api/health probe that verifies the database", () => {
    const index = read("server/_core/index.ts");
    expect(index).toContain('app.get("/api/health"');
    expect(index).toContain('database === "down" ? 503 : 200');
    expect(index).toMatch(/SELECT 1/);
    expect(index).toContain('status: database === "down" ? "unhealthy" : "healthy"');
  });

  it("shuts down gracefully and survives stray rejections", () => {
    const index = read("server/_core/index.ts");
    expect(index).toContain('process.on("SIGTERM"');
    expect(index).toContain('process.on("SIGINT"');
    expect(index).toContain("server.close");
    expect(index).toContain('process.on("unhandledRejection"');
    expect(index).toContain('process.on("uncaughtException"');
  });

  it("warns when the standalone JWT secret is the dev fallback", () => {
    const index = read("server/_core/index.ts");
    expect(index).toContain("JWT_SECRET");
    expect(index).toMatch(/WARNING: JWT_SECRET/);
  });

  it("catalog seeding runs once per process instead of per read", () => {
    const db = read("server/db.ts");
    expect(db).toContain("let schemeCatalogSeeded = false;");
    expect(db).toContain("if (schemeCatalogSeeded) return db;");
    expect(db).toContain("schemeCatalogSeeded = true;");
  });

  it("login redirect-back is open-redirect safe", () => {
    const clientConst = read("client/src/const.ts");
    expect(clientConst).toContain("isSafeReturnPath");
    expect(clientConst).toContain("/login?next=");
    // Guard clauses: reject protocol-relative, backslash, control chars.
    expect(clientConst).toContain('!value.startsWith("//")');
    expect(clientConst).toContain('!value.includes("\\\\")');
    const login = read("client/src/pages/Login.tsx");
    expect(login).toContain("isSafeReturnPath");
    // The consumer must validate too, not trust the URL param blindly.
    expect(login).toMatch(/isSafeReturnPath\(nextParam\)/);
    const auth = read("client/src/_core/hooks/useAuth.ts");
    expect(auth).toContain("startLogin(");
  });

  it("honors X-Forwarded-* headers only when TRUST_PROXY is opted in", () => {
    const env = read("server/_core/env.ts");
    expect(env).toContain("TRUST_PROXY");
    expect(env).toMatch(/TRUST_PROXY === "1"/);
    const index = read("server/_core/index.ts");
    // Express must NOT trust proxy headers by default (spoofable).
    expect(index).toContain('if (TRUST_PROXY)');
    expect(index).toContain('app.set("trust proxy", true)');
  });

  it("API responses are never cached", () => {
    const index = read("server/_core/index.ts");
    expect(index).toContain('app.use("/api"');
    expect(index).toContain('"Cache-Control", "no-store"');
  });

  it("serves a Content-Security-Policy", () => {
    const index = read("server/_core/index.ts");
    expect(index).toContain('"Content-Security-Policy": cspDirectives');
    // No executable plugin content, no third-party origins by default.
    expect(index).toContain('"object-src \'none\'"');
    expect(index).toContain('"connect-src \'self\'"');
    expect(index).toContain('"frame-ancestors \'self\'"');
    // Dev keeps HMR alive via unsafe-eval; production must not have it.
    expect(index).toMatch(/NODE_ENV === "development" \? " 'unsafe-eval'" : ""/);
  });

  it("compresses sizable responses before any route can answer", () => {
    const index = read("server/_core/index.ts");
    expect(index).toContain('import compression from "compression"');
    expect(index).toContain("app.use(compression({ threshold: 1024 }))");
    // Compression must wrap responses before routes register, otherwise
    // anything mounted earlier ships uncompressed.
    expect(
      index.indexOf("app.use(compression(")
    ).toBeLessThan(index.indexOf("registerStorageProxy(app)"));
  });

  it("caches hashed assets forever and entrypoints never", () => {
    const vite = read("server/_core/vite.ts");
    // Content-hashed filenames are safe to cache for a year...
    expect(vite).toContain(
      '"public, max-age=31536000, immutable"'
    );
    // ...while index.html / sw.js / manifest must always revalidate so
    // users pick up new deploys immediately.
    expect(vite).toContain('p.startsWith("/assets/")');
    expect(vite).toContain('res.set("Cache-Control", "no-cache")');
    expect(vite).toContain(
      "index\\.html|sw\\.js|manifest\\.webmanifest|offline\\.html"
    );
  });

  it("code-splits routes so the entry bundle stays small", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain("const Discover = lazy(");
    expect(app).toContain("const Dashboard = lazy(");
    expect(app).toContain("const PilotAdmin = lazy(");
    // Suspense must wrap lazy routes or React errors on render.
    expect(app).toContain("<Suspense");
    // manualChunks is deliberately absent: hand-picked vendor groups created
    // chunk cycles (recharts ↔ react-dom) that crashed module evaluation with
    // a TDZ error, rendering the app blank. Default chunking + React.lazy
    // still splits routes and heavy vendors (pdf, recharts).
    const config = read("vite.config.ts");
    expect(config).not.toContain("manualChunks(id)");
    const main = read("client/src/main.tsx");
    expect(main).toContain("createRoot");
  });

  it("sends HSTS only when opted in", () => {
    const index = read("server/_core/index.ts");
    // HSTS pins HTTPS for a year — only correct behind TLS, so it must be
    // opt-in (plain-HTTP LAN deployments must not accidentally send it).
    expect(index).toContain('process.env.HSTS === "1"');
    expect(index).toContain('"Strict-Transport-Security"');
  });

  it("returns structured API errors and never leaks stack traces", () => {
    const index = read("server/_core/index.ts");
    // Unknown API routes must 404 as JSON — registered BEFORE serveStatic,
    // or the SPA fallback hands API clients index.html with a 200.
    expect(index).toContain('res.status(404).json({ error: { message: "Not found" } })');
    expect(
      index.indexOf('res.status(404).json')
    ).toBeLessThan(index.indexOf("serveStatic(app)"));
    // A thrown route error returns a clean 500 (JSON for /api, HTML for
    // pages) instead of Express's default stack-trace page.
    expect(index).toContain('res.status(500).json({ error: { message: "Internal server error" } })');
    expect(index).toContain("[Server] Unhandled route error:");
  });

  it("self-hosts fonts so the CSP stays third-party-free", () => {
    // An external fonts.googleapis.com @import was silently CSP-blocked
    // (style-src 'self'), so every deployment rendered with fallback fonts
    // AND paid a render-blocking round-trip attempt. Self-hosted woff2 via
    // @fontsource fixes both and works offline through the service worker.
    const css = read("client/src/index.css");
    expect(css).not.toContain("fonts.googleapis.com");
    const main = read("client/src/main.tsx");
    expect(main).toContain("@fontsource/dm-serif-display/400.css");
    expect(main).toContain("@fontsource/plus-jakarta-sans/800.css");
    expect(main).toContain("@fontsource/noto-sans-devanagari/700.css");
  });

  it("keeps third-party preview overlays out of production HTML", () => {
    const config = read("vite.config.ts");
    // index.html is served no-cache, so any inline runtime would re-download
    // on every visit. The config must not pull a preview-runtime plugin, and
    // the built HTML must stay lean and free of runtime markers.
    expect(config).not.toContain("vite-plugin-manus-runtime");
    expect(config).not.toContain("vitePluginManusRuntime");
    const html = read("dist/public/index.html");
    expect(html).not.toContain("manus-runtime");
    expect(html.length).toBeLessThan(10 * 1024);
  });
});
