import { useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Mail } from "lucide-react";

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
    <div className="mkt-page min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="w-2 h-2 rounded-full bg-mkt-green" />
          <span className="font-display font-bold text-xl text-white">cagent</span>
        </div>

        <div className="mkt-card !p-8 hover:!translate-y-0">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={18} className="text-mkt-green" />
            <h1 className="text-lg font-display font-semibold text-white">Reset your password</h1>
          </div>

          {submitted ? (
            <p className="text-sm text-mkt-muted mt-4">
              If an account exists for <span className="text-white">{email}</span>, a reset link is on its way.
            </p>
          ) : (
            <>
              <p className="text-sm text-mkt-muted mb-5 mt-2">
                Enter your email and we'll send you a link to set a new password.
              </p>
              <form onSubmit={submit}>
                <input className="mkt-input mb-5" type="email" placeholder="you@company.com" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
                <button type="submit" disabled={submitting} className="mkt-btn-primary w-full justify-center">
                  <Mail size={16} />
                  {submitting ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-mkt-muted mt-6">
          <Link to="/login" className="mkt-link">&larr; Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}