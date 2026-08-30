import { useEffect, useState } from "react";
import {
  Building2, CheckCircle2, Loader2, Mail, PlusCircle, Search, Users,
} from "lucide-react";
import api from "../lib/api";

/**
 * CompanySettingsPage — the boss-only control room.
 *
 * NOTE ON BACKEND COVERAGE: the employee-creation flow below calls the real
 * POST /api/users/manage/ endpoint built on Day 3. The number search/buy/
 * assign flow calls /api/telephony/numbers/... endpoints that match Part 2D
 * of the spec ("Search & Buy APIs... restricted to ADMIN users") but have
 * NOT been built yet in Days 1-4 — that's Telnyx number purchasing, still
 * pending. This UI is wired to the contract those endpoints should expose;
 * flagging clearly so it isn't mistaken for already-working end-to-end.
 */
export default function CompanySettingsPage() {
  return (
    <div className="min-h-screen">
      <PageHeader />
      <div className="max-w-6xl mx-auto px-6 pb-16 grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <NumberPurchaseCard />
          <TeamCard />
        </div>
        <div className="lg:col-span-2">
          <NumberAssignmentCard />
        </div>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="border-b border-paper-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8 flex items-center gap-4">
        <div className="p-3 rounded-xl bg-signal/8 border border-signal/25 text-signal">
          <Building2 size={22} />
        </div>
        <div>
          <span className="label-eyebrow">Company settings</span>
          <h1 className="text-2xl font-display font-semibold text-ink-900">Numbers, team &amp; access</h1>
        </div>
      </div>
    </div>
  );
}

// --- Number purchasing ---------------------------------------------------------------

function NumberPurchaseCard() {
  const [areaCode, setAreaCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [purchasingId, setPurchasingId] = useState(null);
  const [owned, setOwned] = useState([]);
  const [error, setError] = useState("");

  const loadOwned = () => {
    api
      .get("/api/telephony/numbers/")
      .then((res) => setOwned(res.data?.results || res.data || []))
      .catch(() => {});
  };

  useEffect(loadOwned, []);

  const search = async () => {
    if (!areaCode.trim()) return;
    setSearching(true);
    setError("");
    setResults([]);
    try {
      const res = await api.get("/api/telephony/numbers/search/", { params: { area_code: areaCode } });
      setResults(res.data?.results || res.data || []);
    } catch {
      setError("Couldn't reach the number search API.");
    } finally {
      setSearching(false);
    }
  };

  const purchase = async (phoneNumber) => {
    setPurchasingId(phoneNumber);
    try {
      await api.post("/api/telephony/numbers/purchase/", { phone_number: phoneNumber });
      setResults((prev) => prev.filter((r) => r.phone_number !== phoneNumber));
      loadOwned();
    } catch {
      setError(`Couldn't purchase ${phoneNumber}.`);
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <span className="label-eyebrow">Phone numbers</span>
          <h2 className="text-lg font-display font-semibold text-ink-900">Buy a Telnyx number</h2>
        </div>
        <span className="font-mono text-xs text-ink-400">{owned.length} owned</span>
      </div>

      <div className="flex gap-2 mb-5">
        <input
          className="input-field flex-1"
          placeholder="Area code, e.g. 415"
          value={areaCode}
          onChange={(e) => setAreaCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button onClick={search} disabled={searching} className="btn-primary">
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search
        </button>
      </div>

      {error && <p className="text-xs text-alert mb-4">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-2 mb-2">
          {results.map((r) => (
            <div
              key={r.phone_number}
              className="flex items-center justify-between rounded-lg bg-paper-50 border border-paper-200 px-4 py-3"
            >
              <div>
                <p className="font-mono text-sm text-ink-900">{r.phone_number}</p>
                <p className="text-[11px] text-ink-400">{r.region || r.locality || "United States"}</p>
              </div>
              <button
                onClick={() => purchase(r.phone_number)}
                disabled={purchasingId === r.phone_number}
                className="btn-amber !py-1.5 !px-3 text-xs"
              >
                {purchasingId === r.phone_number ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  `$${r.monthly_cost || "1.00"}/mo`
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {owned.length > 0 && (
        <div className="mt-6 pt-5 border-t border-paper-200">
          <p className="label-eyebrow mb-3">Owned numbers</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {owned.map((n) => (
              <div key={n.id} className="flex items-center gap-2 rounded-lg bg-paper-50 px-3 py-2">
                <CheckCircle2 size={14} className="text-live shrink-0" />
                <span className="font-mono text-xs text-ink-800 truncate">{n.phone_number}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// --- Employee creation -----------------------------------------------------------------

function TeamCard() {
  const [form, setForm] = useState({ username: "", email: "", first_name: "", last_name: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      // Real Day 3 endpoint — ADMIN-only, server always forces role=AGENT.
      await api.post("/api/users/manage/", form);
      setFeedback({ type: "success", text: `Agent account created for ${form.username}.` });
      setForm({ username: "", email: "", first_name: "", last_name: "", password: "" });
      } catch (err) {
      const data = err.response?.data;
      let message = "Couldn't create that account. Check the fields and try again.";
      if (data) {
        if (data.detail) {
          message = data.detail;
        } else if (typeof data === "object") {
          const parts = Object.entries(data).flatMap(([field, errs]) =>
            (Array.isArray(errs) ? errs : [errs]).map((e) => `${field}: ${e}`)
          );
          if (parts.length) message = parts.join(" ");
        }
      }
      setFeedback({ type: "error", text: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Users size={18} className="text-signal" />
        <div>
          <span className="label-eyebrow">Team</span>
          <h2 className="text-lg font-display font-semibold text-ink-900">Add an agent</h2>
        </div>
      </div>

      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
        <input className="input-field" placeholder="Username" required value={form.username} onChange={update("username")} />
        <input className="input-field" type="email" placeholder="Email" required value={form.email} onChange={update("email")} />
        <input className="input-field" placeholder="First name" value={form.first_name} onChange={update("first_name")} />
        <input className="input-field" placeholder="Last name" value={form.last_name} onChange={update("last_name")} />
        <input
          className="input-field sm:col-span-2"
          type="password"
          placeholder="Password"
          required
          value={form.password}
          onChange={update("password")}
        />
        <p className="text-[11px] text-ink-400 sm:col-span-2 -mt-1">
          Must be at least 8 characters, not too common, and not entirely numbers.
        </p>
        <button type="submit" disabled={submitting} className="btn-primary sm:col-span-2 mt-1">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
          Create agent account
        </button>
      </form>

      {feedback && (
        <p className={`text-xs mt-3 ${feedback.type === "success" ? "text-live" : "text-alert"}`}>
          {feedback.text}
        </p>
      )}
    </section>
  );
}

// --- Number -> agent assignment ---------------------------------------------------------

function NumberAssignmentCard() {
  const [numbers, setNumbers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    api.get("/api/telephony/numbers/").then((res) => setNumbers(res.data?.results || res.data || [])).catch(() => {});
    api.get("/api/users/").then((res) => setAgents(res.data?.results || res.data || [])).catch(() => {});
  }, []);

  const assign = async (numberId, userId) => {
    setSavingId(numberId);
    try {
      await api.patch(`/api/telephony/numbers/${numberId}/`, { assigned_user: userId || null });
      setNumbers((prev) => prev.map((n) => (n.id === numberId ? { ...n, assigned_user: userId } : n)));
    } catch {
      /* surface inline in a fuller build; kept minimal here */
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="card p-6 h-fit sticky top-6">
      <div className="flex items-center gap-2 mb-5">
        <Mail size={18} className="text-signal" />
        <div>
          <span className="label-eyebrow">Routing</span>
          <h2 className="text-lg font-display font-semibold text-ink-900">Assign numbers</h2>
        </div>
      </div>

      {numbers.length === 0 && (
        <p className="text-xs text-ink-400">Buy a number on the left to start assigning it to an agent.</p>
      )}

      <div className="space-y-3">
        {numbers.map((n) => (
          <div key={n.id} className="rounded-lg bg-paper-50 border border-paper-200 p-3">
            <p className="font-mono text-sm mb-2 text-ink-900">{n.phone_number}</p>
            <select
              className="input-field !py-1.5 !text-xs"
              value={n.assigned_user || ""}
              disabled={savingId === n.id}
              onChange={(e) => assign(n.id, e.target.value)}
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.username}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}
