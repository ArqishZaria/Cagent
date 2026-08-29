import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Database, Globe, Search, Sparkles } from "lucide-react";
import api from "../lib/api";
import SignalBars from "../components/SignalBars";
import LeadListItem from "../components/LeadListItem";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 300000;

/**
 * AgenticProspectorPage — "Scraper" tab.
 *
 * One search box, one flat $0.50 fee. The backend runs the full waterfall
 * server-side (your list -> shared verified pool -> fresh web scrape) to
 * fill a 25-lead quota, and everything it finds is saved straight to your
 * Leads List — there's no separate "add" step here anymore.
 */
export default function AgenticProspectorPage() {
  const [query, setQuery] = useState("");
  const [task, setTask] = useState(null);
  const [newLeads, setNewLeads] = useState([]);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const startedAtRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => () => clearInterval(pollRef.current), []);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError("");
    setNewLeads([]);
    setTask(null);

    try {
      const res = await api.post("/api/scraper/search/", { query });
      setTask({ id: res.data.id, status: res.data.status });
      startedAtRef.current = Date.now();
      beginPolling(res.data.id);
    } catch (err) {
      if (err.response?.status === 429) {
        setError("Rate limit reached — max 5 searches per hour. Try again shortly.");
      } else if (err.response?.status === 402) {
        setError("Wallet balance too low for a search. Top up to keep prospecting.");
      } else {
        setError("Couldn't start that search. Please try again.");
      }
    }
  };

  const beginPolling = (taskId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) {
        clearInterval(pollRef.current);
        setError("This search is taking longer than expected — check back in a moment.");
        return;
      }
      try {
        const res = await api.get(`/api/scraper/tasks/${taskId}/`);
        setTask(res.data);
        if (res.data.status === "COMPLETED") {
          clearInterval(pollRef.current);
          const leadsRes = await api.get("/api/leads/", { params: { scrape_task: taskId } });
          setNewLeads(leadsRes.data?.results || leadsRes.data || []);
        } else if (res.data.status === "FAILED") {
          clearInterval(pollRef.current);
          setError("This search didn't turn up usable results — try a more specific query.");
        }
      } catch {
        /* transient poll failure — try again next tick */
      }
    }, POLL_INTERVAL_MS);
  };

  const isScraping = task?.status === "PENDING" || task?.status === "RUNNING";
  const total = (task?.existing_count || 0) + (task?.master_pulled_count || 0) + (task?.freshly_scraped_count || 0);

  return (
    <div className="min-h-screen">
      <div className="border-b border-paper-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber/8 border border-amber/25 text-amber-dim">
            <Sparkles size={22} />
          </div>
          <div>
            <span className="label-eyebrow">AI-powered lead generation · $0.50 per search</span>
            <h1 className="text-2xl font-display font-semibold text-ink-900">The Prospector</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <form onSubmit={search} className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input-field !pl-10"
              placeholder="e.g. jewellery stores in Austin, TX"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isScraping}
            />
          </div>
          <button type="submit" disabled={isScraping || !query.trim()} className="btn-amber">
            Prospect
          </button>
        </form>
        <p className="text-[11px] text-ink-400 mb-8">
          Fills up to 25 leads per search — your list, then the shared verified pool, then the web for
          whatever's left. Max 5 searches per hour.
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-alert/25 bg-alert/5 px-4 py-3 mb-8 text-sm text-alert">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {isScraping && <ScrapingState />}

        {task?.status === "COMPLETED" && (
          <>
            <div className="grid sm:grid-cols-3 gap-3 mb-8">
              <SourceStat icon={Database} label="Already in your list" value={task.existing_count} tone="signal" />
              <SourceStat icon={Sparkles} label="From the verified pool" value={task.master_pulled_count} tone="amber" />
              <SourceStat icon={Globe} label="Freshly scraped" value={task.freshly_scraped_count} tone="live" />
            </div>

            {newLeads.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
                {newLeads.map((lead) => (
                  <LeadListItem key={lead.id} lead={lead} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500 text-center py-12">
                {total > 0
                  ? "Every match was already in your Leads List."
                  : "No leads found — try a broader or more specific query."}
              </p>
            )}

            {total > 0 && (
              <div className="text-center mt-8">
                <button onClick={() => navigate("/app/leads")} className="btn-secondary !px-6 !py-2.5 text-sm">
                  View in Leads List
                </button>
              </div>
            )}
          </>
        )}

        {!task && !error && <EmptyState />}
      </div>
    </div>
  );
}

function SourceStat({ icon: Icon, label, value, tone }) {
  const toneClasses = {
    signal: "bg-signal/8 border-signal/25 text-signal",
    amber: "bg-amber/8 border-amber/25 text-amber-dim",
    live: "bg-live/8 border-live/25 text-live",
  }[tone];
  return (
    <div className={`card p-4 flex items-center gap-3 border ${toneClasses}`}>
      <Icon size={18} className="shrink-0" />
      <div>
        <p className="font-display text-xl font-semibold text-ink-900">{value || 0}</p>
        <p className="text-[11px] text-ink-500">{label}</p>
      </div>
    </div>
  );
}

function ScrapingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5 animate-fade-up">
      <SignalBars bars={9} size="lg" color="amber" />
      <p className="font-display text-lg text-ink-900">Searching your list, the verified pool, and the web…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 border border-dashed border-paper-300 rounded-2xl bg-white">
      <p className="text-ink-500 text-sm">
        Describe who you're looking for — industry, city, role — and cagent will fill your list with up to
        25 verified leads.
      </p>
    </div>
  );
}