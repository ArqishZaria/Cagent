import { useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Mail } from "lucide-react";
import SignalBars from "../components/SignalBars";

/**
 * ForgotPasswordPage — UI shell for now. The actual "email a reset link"
 * flow needs a backend endpoint (something like POST /api/auth/password-reset/
 * that emails a one-time link, plus a matching page to set the new password)
 * which we're building in the auth-overhaul stage. Wire the real
 * api.post(...) call into `submit` below once that endpoint exists.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900 px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <SignalBars bars={4} size="sm" color="signal" />
          <span className="font-display font-semibold text-xl">Signal</span>
        </div>

        <div className="card p-8">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={18} className="text-signal-bright" />
            <h1 className="text-lg font-display font-semibold">Reset your password</h1>
          </div>

          {submitted ? (
            <p className="text-sm text-ink-200 mt-4">
              If an account exists for <span className="text-ink-50">{email}</span>, a reset
              link is on its way.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-300 mb-5 mt-2">
                Enter your email and we'll send you a link to set a new password.
              </p>
              <form onSubmit={submit}>
                <input
                  className="input-field mb-5"
                  type="email"
                  placeholder="you@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
                <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
                  <Mail size={16} />
                  {submitting ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-ink-300 mt-6">
          <Link to="/login" className="hover:text-ink-100 transition">
            &larr; Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}