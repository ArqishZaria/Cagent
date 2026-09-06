import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, KeyRound } from "lucide-react";
import api from "../lib/api";
import PasswordInput from "../components/PasswordInput";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const missingLink = !uid || !token;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/users/password-reset/confirm/", {
        uid,
        token,
        new_password: newPassword,
      });
      setSubmitted(true);
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.new_password?.[0] || data?.detail ||
        "This reset link is invalid or has expired — request a new one."
      );
    } finally {
      setSubmitting(false);
    }
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
            <h1 className="text-lg font-display font-semibold text-white">Set a new password</h1>
          </div>

          {missingLink ? (
            <p className="text-sm text-mkt-muted mt-4">
              This link is missing its reset token. Request a new one from the{" "}
              <Link to="/forgot-password" className="mkt-link">forgot password</Link> page.
            </p>
          ) : submitted ? (
            <div className="flex items-start gap-3 mt-4">
              <CheckCircle2 size={18} className="text-mkt-green shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white mb-3">Your password has been updated.</p>
                <button onClick={() => navigate("/login")} className="mkt-btn-primary !py-2.5 !px-5 !text-xs">
                  Sign in
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-2">
              <PasswordInput
                className="mkt-input"
                wrapperClassName="mb-3"
                placeholder="New password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
              <PasswordInput
                className="mkt-input"
                wrapperClassName="mb-3"
                placeholder="Confirm new password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <p className="text-[11px] text-mkt-muted mb-4">
                Must be at least 8 characters, not too common, and not entirely numbers.
              </p>
              {error && <p className="text-xs text-red-400 mb-4">{error}</p>}
              <button type="submit" disabled={submitting} className="mkt-btn-primary w-full justify-center">
                {submitting ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-mkt-muted mt-6">
          <Link to="/login" className="mkt-link">&larr; Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}