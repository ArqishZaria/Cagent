import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Briefcase, Globe, Mail, Search, Sparkles } from "lucide-react";
import api from "../lib/api";
import SignalBars from "../components/SignalBars";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 120000;

/**
 * AgenticProspectorPage
 *
 * POST /api/scraper/search/ (Day 4) queues a ScrapeTask and returns its id
 * with status PENDING immediately — the actual search -> crawl -> Gemini
 * extraction happens asynchronously in a Celery worker. This page polls a
 * status endpoint until the task flips to COMPLETED or FAILED, then loads
 * the leads it produced.
 *
 * NOTE: polling assumes GET /api/scraper/tasks/<id>/ and a way to fetch the
 * leads that task produced (e.g. GET /api/leads/?scrape_task=<id>) — the Day
 * 4 backend built the task + Lead-saving side but not a dedicated read
 * endpoint yet. Wiring this against that expected contract; flagging the gap
 * the same way as the number-purchasing endpoints in Company Settings.
 */
export default function AgenticProspectorPage() {
  const [query, setQuery] = useState("");
  const [task, setTask] = useState(null); // { id, status }
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const startedAtRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError("");
    setLeads([]);
    try {
      const res = await api.post("/api/scraper/search/", { query });
      setTask({ id: res.data.id, status: res.data.status });
      startedAtRef.current = Date.now();
      beginPolling(res.data.id);
    } catch (err) {
      if (err.response?.status === 429) {
        setError("Rate limit reached — max 5 searches per hour. Try again shortly.");
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
        setTask({ id: taskId, status: res.data.status });
        if (res.data.status === "COMPLETED") {
          clearInterval(pollRef.current);
          const leadsRes = await api.get("/api/leads/", { params: { scrape_task: taskId } });
          setLeads(leadsRes.data?.results || leadsRes.data || []);
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

  return (
    <div className="min-h-screen">
      <div className="border-b border-ink-500/50 bg-ink-800/60 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-amber/15 border border-amber/30 text-amber">
            <Sparkles size={22} />
          </div>
          <div>
            <span className="label-eyebrow">$0 agentic lead generation</span>
            <h1 className="text-2xl font-display font-semibold">The Prospector</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <form onSubmit={search} className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              className="input-field !pl-10"
              placeholder="e.g. roofing contractors in Austin, TX"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isScraping}
            />
          </div>
          <button type="submit" disabled={isScraping || !query.trim()} className="btn-amber">
            Prospect
          </button>
        </form>
        <p className="text-[11px] text-ink-300 mb-8">Max 5 searches per hour.</p>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 mb-8 text-sm text-alert">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {isScraping && <ScrapingState />}

        {!isScraping && leads.length > 0 && <LeadsGrid leads={leads} />}

        {!isScraping && task?.status === "COMPLETED" && leads.length === 0 && (
          <p className="text-sm text-ink-300 text-center py-16">
            No qualifying leads found in that search. Try broadening the query.
          </p>
        )}

        {!task && !error && <EmptyState />}
      </div>
    </div>
  );
}

function ScrapingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 animate-fade-up">
      <SignalBars bars={9} size="lg" color="amber" />
      <div className="text-center">
        <p className="font-display text-lg">Scraping live data…</p>
        <p className="text-xs text-ink-300 font-mono mt-1">
	      Searching, verifying, and qualifying leads…
	</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 border border-dashed border-ink-500/50 rounded-2xl">
      <p className="text-ink-200 text-sm">
        Describe who you're looking for — industry, city, role — and the agent will find and
        extract contacts for you.
      </p>
    </div>
  );
}

function LeadsGrid({ leads }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
      {leads.map((lead, i) => (
        <div key={lead.id || i} className="card p-4">
          <p className="font-display font-semibold text-sm">
            {lead.first_name} {lead.last_name}
          </p>
          {lead.job_title && (
            <p className="flex items-center gap-1.5 text-xs text-ink-200 mt-1">
              <Briefcase size={12} /> {lead.job_title}
            </p>
          )}
          {lead.company && <p className="text-xs text-ink-300 mt-0.5">{lead.company}</p>}
          <div className="mt-3 pt-3 border-t border-ink-500/40 space-y-1.5">
            {lead.email && (
              <p className="flex items-center gap-1.5 text-xs font-mono text-ink-100 truncate">
                <Mail size={12} className="shrink-0" /> {lead.email}
              </p>
            )}
            {lead.website && (
              <p className="flex items-center gap-1.5 text-xs font-mono text-ink-100 truncate">
                <Globe size={12} className="shrink-0" /> {lead.website}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
