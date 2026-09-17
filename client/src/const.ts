import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Build-time hint only: the runtime probe below is the source of truth so a
// single client build works on both platform (OAuth) and standalone
// (credentials) servers. Set VITE_AUTH_MODE=credentials as a fallback for
// servers that do not expose /api/auth/mode.
const BUILD_AUTH_MODE: "oauth" | "credentials" =
  import.meta.env.VITE_AUTH_MODE === "credentials" ? "credentials" : "oauth";

type AuthMode = "oauth" | "credentials";

let modePromise: Promise<AuthMode> | null = null;

/**
 * Resolve the server's auth mode at runtime (cached for the page lifetime).
 * Falls back to the build-time flag when the probe is unavailable, e.g.
 * a static-only preview without the backend running.
 */
export function resolveAuthMode(): Promise<AuthMode> {
  if (!modePromise) {
    modePromise = fetch("/api/auth/mode", { credentials: "include" })
      .then(response => (response.ok ? response.json() : null))
      .then(
        (body: { mode?: unknown } | null): AuthMode =>
          body?.mode === "credentials" || body?.mode === "oauth"
            ? body.mode
            : BUILD_AUTH_MODE
      )
      .catch((): AuthMode => BUILD_AUTH_MODE);
  }
  return modePromise;
}

/**
 * A safe post-login destination: an in-app path only. Rejects absolute URLs,
 * protocol-relative "//evil.com", backslashes, and control characters so a
 * crafted ?next= can never bounce the user off-origin after login.
 */
export function isSafeReturnPath(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\r\n\t]/.test(value) &&
    value.length <= 512
  );
}

/**
 * Start the login flow for the server's auth mode. Resolves the mode first
 * (cached), then either navigates to the local /login page or begins the
 * platform OAuth redirect.
 *
 * `returnTo` (e.g. window.location.pathname + search) is carried through as
 * ?next= in credentials mode so the login page can send the user back where
 * they were; the OAuth flow completes on the platform's own callback and
 * ignores it.
 *
 * OAuth mode has SIDE EFFECTS — it mints a one-time nonce, writes the
 * __Host- state cookie, and navigates immediately — so the cookie nonce
 * always matches the `state` it sends. Call it from event handlers or
 * navigation effects only, never during render: each call overwrites the
 * cookie, and a stray render-phase call would desync it from an in-flight
 * login (the callback would reject it with "invalid oauth state").
 */
export const startLogin = async (returnTo?: string): Promise<void> => {
  const mode = await resolveAuthMode();
  if (mode === "credentials") {
    const target =
      returnTo && isSafeReturnPath(returnTo)
        ? `/login?next=${encodeURIComponent(returnTo)}`
        : "/login";
    window.location.href = target;
    return;
  }

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.href = url.toString();
};
