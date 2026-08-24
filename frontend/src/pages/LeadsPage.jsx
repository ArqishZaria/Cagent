import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Loader2, Search } from "lucide-react";
import api from "../lib/api";
import LeadListItem from "../components/LeadListItem";

/**
 * LeadsPage — the standing, always-browsable list of leads. Separate from
 * Prospector (which is for *finding* new leads) and the Dialer (which is
 * for *working* one lead at a time) — this is just "show me everything."
 *
 * What you see here depends on your role, same rule as everywhere else in
 * the CRM: AGENT sees only leads they personally found or uploaded; ADMIN
 * sees the whole team's combined list.
 */
export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const navigate = useNavigate();

  const loadLeads = (params = {}) => {
    setLoading(true);
    api
      .get("/api/leads/", { params })
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data)) {
          setLeads(data);
          setNextUrl(null);
          setCount(data.length);
        } else {
          setLeads(data.results || []);
          setNextUrl(data.next || null);
          setCount(data.count ?? (data.results || []).length);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    loadLeads(search.trim() ? { search: search.trim() } : {});
  };

  const loadMore = async () => {
    if (!nextUrl) return;
    setLoadingMore(true);
    try {
      const res = await api.get(nextUrl);
      setLeads((prev) => [...prev, ...(res.data.results || [])]);
      setNextUrl(res.data.next || null);
    } finally {
      setLoadingMore(false);
    }
  };

  const contactLead = (lead) => {
    navigate("/app", { state: { leadId: lead.id } });
  };

  return (
    <div className="min-h-screen">
      <div className="border-b border-paper-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-signal/8 border border-signal/25 text-signal">
            <ClipboardList size={22} />
          </div>
          <div>
            <span className="label-eyebrow">Your lead database</span>
            <h1 className="text-2xl font-display font-semibold text-ink-900">
              Leads {count ? <span className="text-ink-400 font-normal text-lg">({count})</span> : null}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <form onSubmit={submitSearch} className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input-field !pl-10"
              placeholder="Search by company, city, state, name, email, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-ink-400" size={22} />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-paper-300 rounded-2xl bg-white">
            <p className="text-ink-500 text-sm">
              No leads yet. Find some in the Prospector, or upload a list of your own.
            </p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {leads.map((lead) => (
                <LeadListItem key={lead.id} lead={lead} onContact={contactLead} />
              ))}
            </div>

            {nextUrl && (
              <div className="flex justify-center mt-8">
                <button onClick={loadMore} disabled={loadingMore} className="btn-secondary !px-6 !py-2.5 text-sm">
                  {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
