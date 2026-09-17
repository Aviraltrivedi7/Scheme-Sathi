export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

/**
 * Standalone mode: run the full backend with only Node + MySQL, no Manus
 * platform (no Forge storage/heartbeat/LLM/OAuth). Enabled by omitting the
 * Forge variables; any present Forge config keeps platform mode intact.
 */
export const STANDALONE_MODE = !ENV.forgeApiUrl || !ENV.forgeApiKey;

/**
 * Standalone-mode credential auth. Upgrading the first registered account to
 * admin makes a fresh deployment usable without manual SQL.
 */
export const STANDALONE_ADMIN_EMAIL = (
  process.env.STANDALONE_ADMIN_EMAIL ?? ""
).trim().toLowerCase();

/** Optional OpenAI-compatible LLM endpoint for OCR + help chat in standalone mode. */
export const LLM_BASE_URL = (
  process.env.LLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? ""
).replace(/\/+$/, "");
export const LLM_API_KEY = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
export const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";
export const LLM_VISION_MODEL = process.env.LLM_VISION_MODEL ?? LLM_MODEL;

/**
 * Set TRUST_PROXY=1 only when the app runs behind a reverse proxy (nginx,
 * Caddy, cloud load balancer) that the operator controls. It makes Express
 * derive req.ip / req.protocol from X-Forwarded-* headers so per-IP rate
 * limits and cookie Secure detection work correctly. Behind an untrusted
 * proxy, clients could spoof those headers, so it stays opt-in.
 */
export const TRUST_PROXY =
  process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true";

/** Resolved JWT secret: explicit, or a stable per-installation default so standalone boots without extra setup. */
export function sessionSecret(): string {
  if (ENV.cookieSecret) return ENV.cookieSecret;
  if (!STANDALONE_MODE) return "";
  // Deterministic fallback keeps sessions valid across restarts of the same
  // deployment; multi-instance production should always set JWT_SECRET.
  return "scheme-sathi-standalone-dev-secret";
}
