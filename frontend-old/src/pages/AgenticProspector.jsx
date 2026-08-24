import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Database, Globe, Search, Sparkles } from "lucide-react";
import api from "../lib/api";
import SignalBars from "../components/SignalBars";
import LeadListItem from "../components/LeadListItem";

const POLL_INTERVAL_MS = 2500;
// Raised from 2 minutes -> 5 minutes: scraping more candidate sites (see
// scraper.services.SEARCH_RESULT_LIMIT) genuinely takes longer, even with
// concurrent crawling.
const POLL_TIMEOUT_MS = 300000;

/**
 * AgenticProspectorPage
 *
 * Two-stage search, shown as two clearly separate sections:
 *   1. "From your database" — an instant text search across leads you
 *      already have (GET /api/scraper/existing-leads/), so a repeated or
 *      similar query doesn't make you wait on a fresh scrape for contacts
 *      you've already found before.
 *   2. "New from the web" — the existing scrape pipeline (POST
 *      /api/scraper/search/ -> poll -> GET /api/leads/?scrape_task=<id>),
 *      for anything not already in your database.
 *
 * Both sections render through the same LeadListItem component used in the
 * CRM, and "Contact" on either one jumps straight to that lead's SMS thread.
 */
export default function AgenticProspectorPage() {
  const [query, setQuery] = useState("");
  const [existingLeads, setExistingLeads] = useState([]);
  const [existingSearched, setExistingSearched] = useState(false);
  const [task, setTask] = useState(null);
  const [newLeads, setNewLeads] = useState([]);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const startedAtRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => () => clearInterval(pollRef.current), []);

  const contactLead = (lead) => {
    navigate("/app", { state: { leadId: lead.id } });
  };

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError("");
    setNewLeads([]);
    setExistingLeads([]);
    setExistingSearched(false);
    setTask(null);

    // Stage 1 — instant lookup against leads already in the database.
    try {
      const res = await api.get("/api/scraper/existing-leads/", { params: { query } });
      setExistingLeads(res.data || []);
    } catch {
      // Non-fatal — the fresh scrape below still runs either way.
    } finally {
      setExistingSearched(true);
    }

    // Stage 2 — kick off a fresh web scrape for anything not already found.
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
          const scraped = leadsRes.data?.results || leadsRes.data || [];
          // Avoid showing a lead twice if the database search already surfaced it.
          const existingIds = new Set(existingLeads.map((l) => l.id));
          setNewLeads(scraped.filter((l) => !existingIds.has(l.id)));
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
            <span className="label-eyebrow">AI-powered lead generation</span>
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
        <p className="text-[11px] text-ink-300 mb-8">Max 5 fresh web searches per hour.</p>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 mb-8 text-sm text-alert">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Stage 1 results — from the database */}
        {existingSearched && existingLeads.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Database size={15} className="text-signal-bright" />
              <h2 className="font-display font-semibold text-sm">
                From your database <span className="text-ink-300 font-normal">({existingLeads.length})</span>
              </h2>
            </div>
            <LeadsGrid leads={existingLeads} onContact={contactLead} />
          </section>
        )}

        {/* Stage 2 — the fresh web scrape */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Globe size={15} className="text-live" />
            <h2 className="font-display font-semibold text-sm">New from the web</h2>
          </div>

          {isScraping && <ScrapingState />}

          {!isScraping && newLeads.length > 0 && <LeadsGrid leads={newLeads} onContact={contactLead} />}

          {!isScraping && task?.status === "COMPLETED" && newLeads.length === 0 && (
            <p className="text-sm text-ink-300 text-center py-12">
              No new leads found beyond what's already in your database. Try broadening the query.
            </p>
          )}

          {!task && !error && existingLeads.length === 0 && existingSearched === false && <EmptyState />}
        </section>
      </div>
    </div>
  );
}

function ScrapingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5 animate-fade-up">
      <SignalBars bars={9} size="lg" color="amber" />
      <p className="font-display text-lg">Searching and qualifying leads…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 border border-dashed border-ink-500/50 rounded-2xl">
      <p className="text-ink-200 text-sm">
        Describe who you're looking for — industry, city, role — and cagent will find and
        extract contacts for you.
      </p>
    </div>
  );
}

function LeadsGrid({ leads, onContact }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up">
      {leads.map((lead) => (
        <LeadListItem key={lead.id} lead={lead} onContact={onContact} />
      ))}
    </div>
  );
}