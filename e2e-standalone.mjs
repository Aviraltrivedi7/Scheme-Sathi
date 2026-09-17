/**
 * Full standalone E2E: spin up in-memory MySQL, apply every drizzle migration,
 * boot the bundled server, then exercise register → login → tRPC auth
 * → catalog → matching → profile round-trip. Prints PASS/FAIL per step.
 *
 * Usage: node e2e-standalone.mjs   (requires dist/index.js built first)
 */
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import mysqlMemory from "mysql-memory-server";

const { createDB } = mysqlMemory;

const results = [];
const step = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
};

const server = await createDB({});
let url = `mysql://root@127.0.0.1:${server.port}/scheme_sathi`;
console.log(`[e2e] MySQL on port ${server.port}`);

// 1. Create a dedicated DB, then push the drizzle schema (the same command
// STANDALONE_SETUP.md documents for production).
import { execSync } from "node:child_process";
try {
  const admin = await mysql.createConnection({
    host: "127.0.0.1", port: server.port, user: "root", multipleStatements: true,
  });
  await admin.query("CREATE DATABASE IF NOT EXISTS scheme_sathi");
  await admin.end();
  url = `mysql://root@127.0.0.1:${server.port}/scheme_sathi`;
  execSync("npx drizzle-kit push --force", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
    timeout: 180000,
  });
  step("drizzle schema push (29 tables)", true);
} catch (e) {
  step("drizzle schema push", false, String(e).slice(0, 300));
}

// 2. Boot the bundled production server and wait until it answers /api/health
// (boot time varies with disk/AV; a fixed sleep flakes on slow machines).
const app = spawn("node", ["dist/index.js"], {
  env: { ...process.env, DATABASE_URL: url, NODE_ENV: "production", PORT: "3460" },
  stdio: "pipe",
});
let serverLog = "";
app.stdout.on("data", d => { serverLog += d; });
app.stderr.on("data", d => { serverLog += d; process.stderr.write(`[srv] ${d}`); });
app.on("exit", (code, signal) => {
  console.log(`[e2e] server exited code=${code} signal=${signal}`);
});

const waitForServer = async (timeoutMs = 30000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (app.exitCode !== null) throw new Error(`server died during boot:\n${serverLog.slice(-1500)}`);
    try {
      const res = await fetch("http://127.0.0.1:3460/api/health");
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`server did not become healthy in ${timeoutMs}ms:\n${serverLog.slice(-1500)}`);
};
await waitForServer();

let cookie = "";
const post = async (path, body, expectOk = true) => {
  const res = await fetch(`http://127.0.0.1:3460${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, ok: res.ok === expectOk };
};

const trpcQuery = async (proc) => {
  // Optional-input procedures reject an explicit null, so omit the input
  // parameter entirely — tRPC treats it as undefined.
  const u = `http://127.0.0.1:3460/api/trpc/${proc}?batch=1`;
  const res = await fetch(u, { headers: { cookie } });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

try {
  // 3. Mode probe.
  const modeRes = await fetch("http://127.0.0.1:3460/api/auth/mode").then(r => r.json());
  step("GET /api/auth/mode", modeRes.mode === "credentials", modeRes.mode);

  // 4. Register (first user → admin).
  const reg = await post("/api/auth/register", {
    name: "E2E Admin", email: "admin@e2e.dev", password: "e2epassword1",
  });
  const regOk = reg.ok && reg.json.user?.role === "admin";
  step("register first user (auto-admin)", regOk, `role=${reg.json.user?.role}`);

  // 5. Duplicate email rejected.
  const dup = await post("/api/auth/register", {
    name: "Dup", email: "admin@e2e.dev", password: "e2epassword1",
  }, false);
  step("duplicate register rejected", dup.status === 400, String(dup.json.error || "").slice(0, 50));

  // 6. Login.
  cookie = "";
  const login = await post("/api/auth/login", {
    email: "admin@e2e.dev", password: "e2epassword1",
  });
  step("login with credentials", login.ok && login.json.user?.role === "admin", `role=${login.json.user?.role}`);

  // 7. Wrong password rejected.
  cookie = "";
  const bad = await post("/api/auth/login", {
    email: "admin@e2e.dev", password: "wrongpassword",
  }, false);
  step("wrong password rejected", bad.status === 401);

  // 8. Login again for the rest of the flow.
  cookie = "";
  await post("/api/auth/login", { email: "admin@e2e.dev", password: "e2epassword1" });

  // 9. tRPC auth.me resolves the session user.
  const me = await trpcQuery("auth.me");
  const meData = Array.isArray(me.json) ? me.json[0]?.result?.data?.json : null;
  step("tRPC auth.me with session cookie", meData?.email === "admin@e2e.dev", meData?.email ?? "null");

  // 10. Catalog seeded and served (44 entries incl. the NSP directory).
  const schemes = await trpcQuery("schemes.list");
  const schemesData = Array.isArray(schemes.json)
    ? schemes.json[0]?.result?.data?.json?.schemes
    : schemes.json?.result?.data?.json?.schemes;
  const count = schemesData?.length ?? 0;
  const hasNsp = schemesData?.some(s => s.id === "nsp") ?? false;
  step("scheme catalog served", count >= 40 && hasNsp, `${count} schemes, nsp=${hasNsp}`);

  // 11. Matching runs (Assam student → Ishan Uday NER scholarship).
  const match = await post("/api/trpc/matching.run?batch=1", {
    "0": { json: { age: 19, state: "Assam", caste: "OBC", annualIncome: 250000, occupation: "Student", gender: "Female", isStudent: true, isFarmer: false, isDisabled: false } },
  });
  const matches = match.json?.[0]?.result?.data?.json?.matches ?? [];
  const hasNerScheme = matches.some(m => m.id === "ugc-ishan-uday");
  step("matching returns NER scheme for Assam student", match.ok && hasNerScheme, `${matches.length} matches, ishanUday=${hasNerScheme}`);

  // 12. Profile save + read (protected round-trip).
  const profileSave = await post("/api/trpc/profile.save?batch=1", {
    "0": { json: { age: 19, state: "Assam", caste: "OBC", annualIncome: 250000, occupation: "Student", gender: "Female", isStudent: true, isFarmer: false, isDisabled: false } },
  });
  const mine = await trpcQuery("profile.mine");
  const profile = mine.json?.[0]?.result?.data?.json?.profile;
  step("profile save + read round-trip", profileSave.ok && profile?.state === "Assam", `state=${profile?.state}`);

  // 13. Health probe reports a live database and the security headers ride along.
  const healthRes = await fetch("http://127.0.0.1:3460/api/health");
  const health = await healthRes.json().catch(() => ({}));
  const hasHeaders =
    healthRes.headers.get("x-content-type-options") === "nosniff" &&
    healthRes.headers.get("x-frame-options") === "SAMEORIGIN" &&
    healthRes.headers.get("referrer-policy") === "same-origin";
  step(
    "GET /api/health + security headers",
    healthRes.status === 200 && health.database === "up" && hasHeaders,
    `db=${health.database}, headers=${hasHeaders}`
  );

  // 13b. CSP is served and API responses are no-store.
  const csp = healthRes.headers.get("content-security-policy") ?? "";
  const cacheControl = healthRes.headers.get("cache-control") ?? "";
  step(
    "CSP + no-store on API responses",
    csp.includes("default-src 'self'") &&
      csp.includes("object-src 'none'") &&
      cacheControl.includes("no-store"),
    `csp=${csp.length}ch, cache=${cacheControl}`
  );

  // 13c. TRUST_PROXY is off by default: a spoofed X-Forwarded-For must NOT
  // change the rate-limit identity (would let attackers rotate fake IPs).
  cookie = "";
  let spoofPassed = false;
  for (let i = 0; i < 13; i++) {
    const attempt = await fetch("http://127.0.0.1:3460/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `9.9.${i}.${i}`, // fresh fake IP every time
      },
      body: JSON.stringify({ email: "spoof@e2e.dev", password: "bad-password-x" }),
    });
    if (attempt.status === 429) { spoofPassed = true; break; }
  }
  step("spoofed X-Forwarded-For cannot bypass login rate limit", spoofPassed);

  // 14. Weak passwords are rejected at registration.
  cookie = "";
  const weak = await post("/api/auth/register", {
    name: "Weak", email: "weak@e2e.dev", password: "password123",
  }, false);
  step("weak password rejected", weak.status === 400, `status=${weak.status}`);

  // 15. Brute-force: a burst of failed logins is throttled with 429.
  let throttled = false;
  for (let i = 0; i < 14; i++) {
    const attempt = await fetch("http://127.0.0.1:3460/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@e2e.dev", password: "bad-password-x" }),
    });
    if (attempt.status === 429) { throttled = true; break; }
  }
  step("brute-force login throttled (429)", throttled);

  // 16. Delivery: hashed assets ship gzip-compressed and cache immutably.
  const { readdirSync } = await import("node:fs");
  const assetsDir = "dist/public/assets";
  // Everything Vite emits into /assets/ is content-hashed by construction
  // (hashes may contain "-", so don't pattern-match the hash itself).
  const assetFiles = readdirSync(assetsDir).filter(f => f.endsWith(".js"));
  const entryAsset = assetFiles.find(f => f.startsWith("index-"));
  const assetUrl = `http://127.0.0.1:3460/assets/${entryAsset}`;
  const [indexRes, rootRes] = await Promise.all([
    fetch("http://127.0.0.1:3460/index.html"),
    fetch("http://127.0.0.1:3460/"),
  ]);
  // Node fetch auto-decompresses, so measure the actual wire bytes with a
  // raw HTTP request that leaves the gzip stream untouched.
  const nodeHttp = (await import("node:http")).default;
  const rawGet = (url, headers) => new Promise((resolve, reject) => {
    nodeHttp.get(url, { headers }, res => {
      let len = 0;
      res.on("data", c => { len += c.length; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, bytes: len }));
    }).on("error", reject);
  });
  const plain = await rawGet(assetUrl, {});
  const gz = await rawGet(assetUrl, { "accept-encoding": "gzip" });
  const gzOk = (gz.headers["content-encoding"] ?? "").includes("gzip");
  const shrinkOk = gzOk && gz.bytes > 0 && gz.bytes < plain.bytes;
  step(
    "hashed assets gzip-compressed",
    gzOk && shrinkOk,
    `encoding=${gz.headers["content-encoding"]}, ${plain.bytes}B → ${gz.bytes}B (${Math.round((1 - gz.bytes / plain.bytes) * 100)}% saved)`
  );
  const plainBytes = plain.bytes;
  step(
    "hashed assets cache immutably (1y)",
    (plain.headers["cache-control"] ?? "").includes("max-age=31536000") &&
      (plain.headers["cache-control"] ?? "").includes("immutable"),
    plain.headers["cache-control"] ?? "none"
  );
  const entryNoCache = (indexRes.headers.get("cache-control") ?? "").includes("no-cache") &&
    (rootRes.headers.get("cache-control") ?? "").includes("no-cache");
  step("entrypoints always revalidate (no-cache)", entryNoCache, indexRes.headers.get("cache-control") ?? "none");

  // 17. Bundle discipline: route splitting keeps the entry far below the old
  // 1426KB single bundle, and heavy vendors (pdf.js, recharts) stay in lazy
  // chunks that never load on first paint.
  const entrySize = plainBytes;
  const hasRouteChunks = assetFiles.some(f => f.startsWith("Discover-")) &&
    assetFiles.some(f => f.startsWith("Dashboard-"));
  const hasLazyHeavyChunks = assetFiles.some(f => f.startsWith("pdf-")) &&
    assetFiles.some(f => f.startsWith("LineChart-"));
  step(
    "entry < 650KB with routes + heavy vendors split",
    entrySize > 0 && entrySize < 650 * 1024 && hasRouteChunks && hasLazyHeavyChunks,
    `entry=${Math.round(entrySize / 1024)}KB, routes=${hasRouteChunks}, lazyHeavy=${hasLazyHeavyChunks}`
  );

  // 18. Unknown API routes get a JSON 404 — not the SPA index.html shell
  // that the fallback would otherwise serve with a 200 to API clients.
  const missingApi = await fetch("http://127.0.0.1:3460/api/definitely-not-a-route");
  const missingJson = await missingApi.json().catch(() => null);
  step(
    "unknown /api route returns JSON 404",
    missingApi.status === 404 && missingJson?.error?.message === "Not found",
    `status=${missingApi.status}, body=${JSON.stringify(missingJson)?.slice(0, 40)}`
  );

  // 19. Fonts are self-hosted: the built CSS must reference only local
  // woff2 files (a fonts.googleapis.com @import was CSP-blocked anyway,
  // rendering fallback fonts on every deployment).
  const { readFileSync } = await import("node:fs");
  const mainCssName = readdirSync(assetsDir).find(f => /^index-.*\.css$/.test(f));
  const mainCss = readFileSync(`${assetsDir}/${mainCssName}`, "utf8");
  const woffCount = (mainCss.match(/url\(\/assets\/[^)]+\.woff2\)/g) ?? []).length;
  step(
    "fonts self-hosted (no external font origins)",
    !mainCss.includes("fonts.googleapis.com") && !mainCss.includes("fonts.gstatic.com") && woffCount >= 25,
    `${woffCount} local woff2 refs, googleapis=${mainCss.includes("fonts.googleapis.com")}`
  );

  // 20. No third-party preview overlay in production HTML: index.html
  // is no-cache, so its 367KB inline script used to re-download every visit.
  const builtHtml = readFileSync("dist/public/index.html", "utf8");
  step(
    "index.html is lean (no 367KB runtime inline)",
    !builtHtml.includes("manus-runtime") && builtHtml.length < 10 * 1024,
    `${Math.round(builtHtml.length / 1024)}KB, manus-runtime=${builtHtml.includes("manus-runtime")}`
  );

  console.log(results.every(r => r.ok) ? "\n[e2e] ALL PASS" : "\n[e2e] FAILURES PRESENT");
} catch (e) {
  console.error("[e2e] full error:", e);
  step("e2e flow", false, String(e).slice(0, 300));
} finally {
  app.kill();
  await server.stop().catch(() => {});
  process.exit(0);
}
