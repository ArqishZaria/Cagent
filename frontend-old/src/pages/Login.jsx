import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import SignalBars from "../components/SignalBars";
import api from "../lib/api";

/**
 * LoginPage — deliberately standalone. It does NOT render inside the portal
 * layout (no sidebar, no app chrome) — someone who isn't logged in should
 * never see a hint of what's behind the login screen.
 */
export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/token/", { username, password });
      localStorage.setItem("access_token", res.data.access);
      localStorage.setItem("refresh_token", res.data.refresh);
      localStorage.setItem("last_active", String(Date.now()));
      navigate("/app");
    } catch (err) {
      setError("That username or password isn't right.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900 px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <SignalBars bars={4} size="sm" color="signal" />
          <span className="font-display font-semibold text-xl">cagent</span>
        </div>

        <form onSubmit={submit} className="card p-8">
          <div className="flex items-center gap-2 mb-6">
            <LogIn size={18} className="text-signal-bright" />
            <h1 className="text-lg font-display font-semibold">Sign in</h1>
          </div>

          <label className="label-eyebrow block mb-1.5">Username</label>
          <input
            className="input-field mb-4"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />

          <div className="flex items-center justify-between mb-1.5">
            <label className="label-eyebrow">Password</label>
            <Link to="/forgot-password" className="text-xs text-signal-bright hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            className="input-field mb-5"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-xs text-alert mb-4">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-ink-300 mt-6">
          <Link to="/" className="hover:text-ink-100 transition">
            &larr; Back to cagent
          </Link>
        </p>
      </div>
    </div>
  );
}