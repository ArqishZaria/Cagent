import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { PhoneCall } from "lucide-react";
import api from "../lib/api";
import LeadChatPanel from "../components/LeadChatPanel";
import LeadListItem from "../components/LeadListItem";

export default function CrmDialerPage() {
  const [leads, setLeads] = useState([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [fromNumber, setFromNumber] = useState(null); // { id, phone_number } once loaded
  const location = useLocation();

  useEffect(() => {
    api
      .get("/api/leads/")
      .then((res) => {
        const data = res.data?.results || res.data || [];
        setLeads(data);
        const requestedLeadId = location.state?.leadId;
        if (requestedLeadId && data.some((l) => l.id === requestedLeadId)) {
          setActiveLeadId(requestedLeadId);
        } else if (data.length) {
          setActiveLeadId(data[0].id);
        }
      })
      .finally(() => setLeadsLoaded(true));

    api.get("/api/telephony/numbers/").then((res) => {
      const owned = res.data?.results || res.data || [];
      if (owned.length) setFromNumber({ id: owned[0].id, phone_number: owned[0].phone_number });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeLead = leads.find((l) => l.id === activeLeadId) || null;

  return (
    <div className="flex h-screen">
      <aside className="w-[320px] shrink-0 border-r border-paper-200 bg-white flex flex-col">
        <div className="px-5 py-4 border-b border-paper-200 flex items-center gap-2">
          <PhoneCall size={18} className="text-signal" />
          <h1 className="font-display font-semibold text-ink-900">Chats</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {leadsLoaded && leads.length === 0 && (
            <p className="text-xs text-ink-400 px-3 py-6 text-center">No leads yet.</p>
          )}
          {leads.map((lead) => (
            <LeadListItem
              key={lead.id}
              lead={lead}
              compact
              active={lead.id === activeLeadId}
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