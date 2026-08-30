// frontend/src/pages/CrmDialerView.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PhoneCall, Search, X } from "lucide-react";
import api from "../lib/api";
import LeadChatPanel from "../components/LeadChatPanel";
import LeadListItem from "../components/LeadListItem";

const POLL_INTERVAL_MS = 4000; // was 6000 — snappier while we don't have push yet

// --- unread read-state (per-device, localStorage-backed) ---------------------------
// Compares each lead's last_message_at (already returned by the API) against
// the last time THIS BROWSER had that chat open. No push channel yet, so this
// can't sync across teammates/devices — it's a stopgap, not a corner cut: it
// only ever compares timestamps (never counts), so there's no double-count
// risk from refetch races the way a naive unread-counter would have.
const READ_STATE_KEY = "cagent:chatLastRead";

function loadReadState() {
  try {
    return JSON.parse(localStorage.getItem(READ_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveReadState(state) {
  try {
    localStorage.setItem(READ_STATE_KEY, JSON.stringify(state));
  } catch {
    /* storage full/unavailable — unread badges just won't persist, non-fatal */
  }
}

export default function CrmDialerPage() {
  const [leads, setLeads] = useState([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [fromNumber, setFromNumber] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [readTick, setReadTick] = useState(0); // bumped to force unread-map recompute after a write
  const location = useLocation();
  const pollRef = useRef(null);

  const fetchLeads = (preserveSelection = true) => {
    return api
      .get("/api/leads/", { params: { contacted: true } })
      .then((res) => {
        const data = res.data?.results || res.data || [];
        setLeads(data);
        if (!preserveSelection) {
          const requestedLeadId = location.state?.leadId;
          if (requestedLeadId && data.some((l) => l.id === requestedLeadId)) {
            setActiveLeadId(requestedLeadId);
          } else if (data.length) {
            setActiveLeadId(data[0].id);
          }
        }
        return data;
      });
  };

  useEffect(() => {
    fetchLeads(false).finally(() => setLeadsLoaded(true));

    api.get("/api/telephony/numbers/").then((res) => {
      const owned = res.data?.results || res.data || [];
      if (owned.length) setFromNumber({ id: owned[0].id, phone_number: owned[0].phone_number });
    });

    // Backend already sorts by last message time — poll so a new inbound
    // text (from an existing chat, or a brand-new number texting in for
    // the first time) surfaces here without a manual reload.
    pollRef.current = setInterval(() => fetchLeads(true), POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If we were routed here directly with a specific lead in mind (e.g. from
  // Call Logs' "Message" button, or Leads List "Contact"), select it —
  // works even if the poll above already refreshed the list first.
  useEffect(() => {
    const requestedLeadId = location.state?.leadId;
    if (requestedLeadId) setActiveLeadId(requestedLeadId);
  }, [location.state]);

  const activeLead = leads.find((l) => l.id === activeLeadId) || null;

  // Whenever the active lead (or its last_message_at) changes, treat it as
  // read right now — covers both "just opened this chat" and "poll brought
  // in a newer message while this chat is already open on screen."
  useEffect(() => {
    if (!activeLead) return;
    const state = loadReadState();
    const stamp = activeLead.last_message_at || new Date().toISOString();
    if (state[activeLead.id] !== stamp) {
      state[activeLead.id] = stamp;
      saveReadState(state);
      setReadTick((t) => t + 1);
    }
  }, [activeLead?.id, activeLead?.last_message_at]);

  const unreadLeadIds = useMemo(() => {
    const state = loadReadState();
    const unread = new Set();
    leads.forEach((l) => {
      if (!l.last_message_at) return;
      const readAt = state[l.id];
      if (!readAt || new Date(l.last_message_at) > new Date(readAt)) {
        unread.add(l.id);
      }
    });
    return unread;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, readTick]);

  const query = search.trim().toLowerCase();
  const visibleLeads = query
    ? leads.filter((l) => {
        const name = `${l.first_name || ""} ${l.last_name || ""}`.toLowerCase();
        const phone = (l.phone_number || "").toLowerCase();
        // Deliberately name/number only — not company, not message content.
        return name.includes(query) || phone.includes(query);
      })
    : leads;

  return (
    <div className="flex h-full">
      <aside className="w-[320px] shrink-0 border-r border-paper-200 bg-white flex flex-col">
        <div className="px-5 py-4 border-b border-paper-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PhoneCall size={18} className="text-signal" />
            <h1 className="font-display font-semibold text-ink-900">Chats</h1>
          </div>
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setSearch("");
            }}
            className="text-ink-400 hover:text-ink-900 transition p-1"
            aria-label="Search chats"
          >
            {searchOpen ? <X size={16} /> : <Search size={16} />}
          </button>
        </div>

        {searchOpen && (
          <div className="px-3 pt-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                autoFocus
                className="input-field !pl-8 !py-2 !text-sm"
                placeholder="Search name or number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {leadsLoaded && leads.length === 0 && (
            <p className="text-xs text-ink-400 px-3 py-6 text-center leading-relaxed">
              Empty until you contact someone — press "Contact" on a lead in the Leads List,
              or wait for someone to text/call in.
            </p>
          )}
          {leadsLoaded && leads.length > 0 && visibleLeads.length === 0 && (
            <p className="text-xs text-ink-400 px-3 py-6 text-center">
              No chats match "{search}".
            </p>
          )}
          {visibleLeads.map((lead) => (
            <LeadListItem
              key={lead.id}
              lead={lead}
              compact
              active={lead.id === activeLeadId}
              unread={unreadLeadIds.has(lead.id)}
              onSelect={() => setActiveLeadId(lead.id)}
            />
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <LeadChatPanel lead={activeLead} fromNumber={fromNumber} />
      </div>
    </div>
  );
}