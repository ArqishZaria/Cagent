import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Check, KeyRound, Loader2, LogOut, Phone, ShieldCheck, User,
} from "lucide-react";
import api from "../lib/api";
import { useCurrentUser } from "../lib/currentUser";
import { logout } from "../lib/auth";
const SUB_STATUS_COLORS = {
  ACTIVE: "bg-live/10 text-live border-live/25",
  PAID_OVERDUE: "bg-alert/10 text-alert border-alert/25",
  CANCELLED: "bg-ink-100 text-ink-500 border-ink-200",
};

export default function ProfilePage() {
  const { user, loading, refresh, isAdmin } = useCurrentUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };
  
  return (
    <div className="min-h-screen">
      <div className="border-b border-paper-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-signal/8 border border-signal/25 text-signal">
              <User size={22} />
            </div>
            <div>
              <span className="label-eyebrow">Your account</span>
              <h1 className="text-2xl font-display font-semibold text-ink-900">Profile</h1>
            </div>
          </div>
          <button onClick={logout} className="btn-secondary !text-xs !py-2">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      {loading || !user ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-ink-400" size={22} />
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-6 py-8 grid lg:grid-cols-2 gap-6">
          <AccountDetailsCard user={user} onSaved={refresh} />
          <ChangePasswordCard />
          <CompanyCard user={user} isAdmin={isAdmin} />
          <PhoneNumbersCard user={user} isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}

function AccountDetailsCard({ user, onSaved }) {
  const [form, setForm] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email || "",
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await api.patch("/api/users/me/", form);
      setFeedback({ type: "success", text: "Saved." });
      onSaved();
    } catch {
      setFeedback({ type: "error", text: "Couldn't save your changes." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <User size={18} className="text-signal" />
        <div>
          <span className="label-eyebrow">Account</span>
          <h2 className="text-lg font-display font-semibold text-ink-900">Your details</h2>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label-eyebrow block mb-1.5">Username</label>
          <input className="input-field opacity-60" value={user.username} disabled />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-eyebrow block mb-1.5">First name</label>
            <input className="input-field" value={form.first_name} onChange={update("first_name")} />
          </div>
          <div>
            <label className="label-eyebrow block mb-1.5">Last name</label>
            <input className="input-field" value={form.last_name} onChange={update("last_name")} />
          </div>
        </div>
        <div>
          <label className="label-eyebrow block mb-1.5">Email</label>
          <input className="input-field" type="email" value={form.email} onChange={update("email")} />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${
            user.role === "ADMIN" ? "bg-amber/10 text-amber-dim border-amber/25" : "bg-signal/10 text-signal border-signal/25"
          }`}>
            {user.role === "ADMIN" ? "Admin (Boss)" : "Agent"}
          </span>
          <span className="text-[11px] text-ink-400">
            Member since {new Date(user.date_joined).toLocaleDateString()}
          </span>
        </div>
        <button type="submit" disabled={saving} className="btn-primary !mt-4">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Save changes
        </button>
        {feedback && (
          <p className={`text-xs ${feedback.type === "success" ? "text-live" : "text-alert"}`}>{feedback.text}</p>
        )}
      </form>
    </section>
  );
}

function ChangePasswordCard() {
  const [form, setForm] = useState({ old_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    if (form.new_password !== form.confirm) {
      setFeedback({ type: "error", text: "New passwords don't match." });
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/users/change-password/", {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      setFeedback({ type: "success", text: "Password updated." });
      setForm({ old_password: "", new_password: "", confirm: "" });
    } catch (err) {
      const data = err.response?.data;
      const message = data?.old_password?.[0] || data?.new_password?.[0] || data?.detail || "Couldn't update password.";
      setFeedback({ type: "error", text: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <KeyRound size={18} className="text-signal" />
        <div>
          <span className="label-eyebrow">Security</span>
          <h2 className="text-lg font-display font-semibold text-ink-900">Change password</h2>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input className="input-field" type="password" placeholder="Current password" required
          value={form.old_password} onChange={update("old_password")} />
        <input className="input-field" type="password" placeholder="New password" required
          value={form.new_password} onChange={update("new_password")} />
        <input className="input-field" type="password" placeholder="Confirm new password" required
          value={form.confirm} onChange={update("confirm")} />
        <p className="text-[11px] text-ink-400">
          Must be at least 8 characters, not too common, and not entirely numbers.
        </p>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          Update password
        </button>
        {feedback && (
          <p className={`text-xs ${feedback.type === "success" ? "text-live" : "text-alert"}`}>{feedback.text}</p>
        )}
      </form>
    </section>
  );
}

function CompanyCard({ user, isAdmin }) {
  return (
    <section className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Building2 size={18} className="text-signal" />
        <div>
          <span className="label-eyebrow">Workspace</span>
          <h2 className="text-lg font-display font-semibold text-ink-900">Company</h2>
        </div>
      </div>
      <div className="space-y-3 text-sm">
        <Row label="Company name" value={user.company_name || "—"} />
        {isAdmin && (
          <div className="flex items-center justify-between">
            <span className="text-ink-500">Subscription</span>
            <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${SUB_STATUS_COLORS[user.subscription_status] || SUB_STATUS_COLORS.ACTIVE}`}>
              {user.subscription_status}
            </span>
          </div>
        )}
        <Row label="Your role" value={user.role === "ADMIN" ? "Admin (Boss)" : "Agent (Employee)"} />
      </div>
      {isAdmin && (
        <p className="text-[11px] text-ink-400 mt-4 pt-4 border-t border-paper-200">
          Manage numbers and teammates in <span className="text-signal font-medium">Settings</span>.
        </p>
      )}
    </section>
  );
}

function PhoneNumbersCard({ user, isAdmin }) {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/telephony/numbers/")
      .then((res) => {
        const all = res.data?.results || res.data || [];
        setNumbers(isAdmin ? all : all.filter((n) => n.assigned_user === user.id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin, user.id]);

  return (
    <section className="card p-6 lg:col-span-2">
      <div className="flex items-center gap-2 mb-5">
        <Phone size={18} className="text-signal" />
        <div>
          <span className="label-eyebrow">Telephony</span>
          <h2 className="text-lg font-display font-semibold text-ink-900">
            {isAdmin ? "Company phone numbers" : "Your assigned number"}
          </h2>
        </div>
      </div>
      {loading ? (
        <Loader2 size={16} className="animate-spin text-ink-400" />
      ) : numbers.length === 0 ? (
        <p className="text-xs text-ink-400">
          {isAdmin ? "No numbers purchased yet — buy one in Settings." : "No number assigned to you yet — ask your admin."}
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {numbers.map((n) => (
            <div key={n.id} className="flex items-center justify-between rounded-lg bg-paper-50 border border-paper-200 px-3.5 py-2.5">
              <span className="font-mono text-sm text-ink-900">{n.phone_number}</span>
              {isAdmin && <span className="text-[11px] text-ink-400">${n.monthly_cost}/mo</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-900 font-medium">{value}</span>
    </div>
  );
}