import { useRef, useState, type FormEvent } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

const RECAPTCHA_SITE_KEY = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || "").trim();

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const captchaRef = useRef<ReCAPTCHA | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-sm text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (RECAPTCHA_SITE_KEY && !captchaToken) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }

    setSubmitting(true);
    try {
      await login(identifier.trim(), password, captchaToken);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      captchaRef.current?.reset();
      setCaptchaToken("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-lg">
        <p className="text-sm font-semibold tracking-wide text-[var(--brand)]">NameCardScan</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--ink)]">CMS Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Super Admin only. Uses the existing Business Card Scanner backend.
        </p>

        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="identifier">
              Email or username
            </label>
            <input
              id="identifier"
              className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--brand)] focus:ring-2"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--brand)] focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {RECAPTCHA_SITE_KEY ? (
            <div className="overflow-x-auto">
              <ReCAPTCHA
                ref={captchaRef}
                sitekey={RECAPTCHA_SITE_KEY}
                onChange={(token) => setCaptchaToken(token || "")}
                onExpired={() => setCaptchaToken("")}
                onError={() => {
                  setCaptchaToken("");
                  setError("CAPTCHA failed to load. Refresh and try again.");
                }}
              />
            </div>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Missing <code>VITE_RECAPTCHA_SITE_KEY</code>. Production login requires Google
              reCAPTCHA v2.
            </p>
          )}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[var(--brand)] px-4 py-2.5 font-medium text-white transition hover:opacity-95 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
