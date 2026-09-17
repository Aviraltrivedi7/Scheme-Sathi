import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { isSafeReturnPath } from "@/const";
import "./Login.css";

type LoginMode = "login" | "register";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<LoginMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Where to send the user after a successful sign-in. Only same-app paths
  // ("/schemes?x=1") pass; absolute or protocol-relative URLs are ignored so
  // ?next= can never be used as an open redirect.
  const nextParam = new URLSearchParams(window.location.search).get("next");
  const returnTo =
    nextParam && isSafeReturnPath(nextParam) ? nextParam : "/dashboard";

  const finish = () => {
    // Cookie is set; hard navigation guarantees the tRPC client and query
    // caches start fresh with the authenticated session.
    window.location.href = returnTo;
  };

  // Redirect an already-signed-in visitor away from the login screen.
  useEffect(() => {
    if (isAuthenticated) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body =
        mode === "register" ? { name, email, password } : { email, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Sign in failed. Please try again.");
        return;
      }
      finish();
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="login-page">
      <header className="login-nav">
        <Link href="/" className="login-back-link">
          <ArrowLeft size={16} /> Scheme Sathi
        </Link>
      </header>

      <section className="login-card" aria-label="Account sign in">
        <div className="login-heading">
          <p className="section-kicker">
            {mode === "register" ? "CREATE ACCOUNT" : "WELCOME BACK"}
          </p>
          <h1>
            {mode === "register"
              ? "Create your Scheme Sathi account."
              : "Sign in to Scheme Sathi."}
          </h1>
          <p className="login-sub">
            {mode === "register"
              ? "Your profile, saved schemes, and documents stay private to your account."
              : "Access your saved schemes, applications, and documents."}
          </p>
        </div>

        <form className="login-form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              <span>Full name</span>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                minLength={2}
                maxLength={120}
                required
                autoComplete="name"
              />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              maxLength={320}
              required
              autoComplete="email"
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              required
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
            {mode === "register" && (
              <small className="login-hint">At least 8 characters.</small>
            )}
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button className="login-submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="spin" size={17} /> Please wait…
              </>
            ) : mode === "register" ? (
              <>
                <UserPlus size={17} /> Create account
              </>
            ) : (
              <>
                <LogIn size={17} /> Sign in
              </>
            )}
          </button>
        </form>

        <p className="login-switch">
          {mode === "register" ? (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("login")}>
                Sign in
              </button>
            </>
          ) : (
            <>
              New to Scheme Sathi?{" "}
              <button type="button" onClick={() => setMode("register")}>
                Create an account
              </button>
            </>
          )}
        </p>

        <p className="login-trust">
          <ShieldCheck size={14} /> We never ask for Aadhaar, bank details, or
          OTPs.
        </p>
      </section>
    </main>
  );
}
