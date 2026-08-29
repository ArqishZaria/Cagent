import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Loader2, MessageSquareText, Search } from "lucide-react";
import api from "../lib/api";
import BulkUploadPanel from "../components/BulkUploadPanel";

const STATUS_COLORS = {
  NEW: "bg-ink-100 text-ink-700 border-ink-200",
  CONTACTED: "bg-amber/10 text-amber-dim border-amber/25",
  QUALIFIED: "bg-signal/10 text-signal border-signal/25",
  WON: "bg-live/10 text-live border-live/25",
  LOST: "bg-alert/10 text-alert border-alert/25",
};

/**
 * LeadsPage — "Leads List" tab. A plain table of every lead the tenant
 * owns. "Contact" is the only bridge into the CRM/Dialer tab: it marks the
 * lead contacted (POST /api/leads/<id>/contact/) and only then does it
 * appear over there — the dialer stays empty otherwise.
 */
export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [contactingId, setContactingId] = useState(null);
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

  const contactLead = async (lead) => {
    setContactingId(lead.id);
    try {
      await api.post(`/api/leads/${lead.id}/contact/`);
      navigate("/app", { state: { leadId: lead.id } });
    } catch {
      setContactingId(null);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="border-b border-paper-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-live/8 border border-live/25 text-live">
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
        <BulkUploadPanel onComplete={() => loadLeads()} />

        <form onSubmit={submitSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input-field !pl-10"
              placeholder="Search by company, city, state, name, email, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-ink-400" size={22} />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-paper-300 rounded-2xl bg-white">
            <p className="text-ink-500 text-sm">
              No leads yet. Find some in the Prospector, or upload a list above.
            </p>
          </div>
        ) : (
          <>
            <div className="card overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-paper-200 bg-paper-50 text-left">
                    <Th>Name</Th>
                    <Th>Company</Th>
                    <Th>Location</Th>
                    <Th>Phone</Th>
                    <Th>Email</Th>
                    <Th>Status</Th>
                    <Th>Deal value</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const name = `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "—";
                    const location = [lead.city, lead.state].filter(Boolean).join(", ") || "—";
                    return (
                      <tr key={lead.id} className="border-b border-paper-100 last:border-b-0 hover:bg-paper-50/60">
                        <Td className="font-medium text-ink-900">{name}</Td>
                        <Td>{lead.company || "—"}</Td>
                        <Td className="text-ink-500">{location}</Td>
                        <Td className="font-mono text-xs">{lead.phone_number || "—"}</Td>
                        <Td className="font-mono text-xs">{lead.email || "—"}</Td>
                        <Td>
                          <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_COLORS[lead.status] || STATUS_COLORS.NEW}`}>
                            {lead.status || "NEW"}
                          </span>
                        </Td>
                        <Td className="font-mono text-amber-dim">
                          {lead.deal_value ? `$${Number(lead.deal_value).toLocaleString()}` : "—"}
                        </Td>
                        <Td>
                          <button
                            onClick={() => contactLead(lead)}
                            disabled={contactingId === lead.id || lead.do_not_contact}
                            className="btn-primary !py-1.5 !px-3 text-xs whitespace-nowrap"
                            title={lead.do_not_contact ? "This lead opted out" : "Contact"}
                          >
                            {contactingId === lead.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <MessageSquareText size={12} />
                            )}
                            {lead.contacted_at ? "Open chat" : "Contact"}
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {nextUrl && (
              <div className="flex justify-center mt-8">
                <button onClick={loadMore} disabled={loadingMore} className="btn-ghost !px-6 !py-2.5 text-sm">
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

function Th({ children }) {
  return <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wide text-ink-500">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}