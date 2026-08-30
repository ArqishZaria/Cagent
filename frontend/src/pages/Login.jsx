import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import api from "../lib/api";

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
    <div className="mkt-page min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-mkt-green/[0.06] blur-[120px] pointer-events-none" />
      <div className="w-full max-w-sm relative">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="w-2 h-2 rounded-full bg-mkt-green" />
          <span className="font-display font-bold text-xl text-white">Cagent</span>
        </div>

        <form onSubmit={submit} className="mkt-card !p-8 hover:!translate-y-0">
          <div className="flex items-center gap-2 mb-6">
            <LogIn size={18} className="text-mkt-green" />
            <h1 className="text-lg font-display font-semibold text-white">Sign in</h1>
          </div>

          <label className="mkt-eyebrow block mb-1.5">Username</label>
          <input className="mkt-input mb-4" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />

          <div className="flex items-center justify-between mb-1.5">
            <label className="mkt-eyebrow">Password</label>
          </div>
          <input className="mkt-input mb-5" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Link to="/forgot-password" className="mkt-link text-xs">Forgot password?</Link>

          {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

          <button type="submit" disabled={loading} className="mkt-btn-primary w-full justify-center">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-mkt-muted mt-6">
          <Link to="/" className="mkt-link">&larr; Back to Cagent</Link>
        </p>
      </div>
    </div>
  );
}