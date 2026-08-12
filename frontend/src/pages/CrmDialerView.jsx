import { useEffect, useState } from "react";
import { DollarSign, PhoneCall } from "lucide-react";
import api from "../lib/api";
import AppTelnyxProvider from "../lib/TelnyxProvider";
import LeadChatPanel from "../components/LeadChatPanel";
import Dialer from "../components/Dialer";

const PIPELINE_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

export default function CrmDialerPage() {
  const [leads, setLeads] = useState([]);
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [fromNumber, setFromNumber] = useState(null);

  useEffect(() => {
    api.get("/api/leads/").then((res) => {
      const data = res.data?.results || res.data || [];
      setLeads(data);
      if (data.length && !activeLeadId) setActiveLeadId(data[0].id);
    });
    // The number this agent dials/texts FROM — first assigned PhoneNumber.
    api.get("/api/telephony/numbers/").then((res) => {
      const owned = res.data?.results || res.data || [];
      if (owned.length) setFromNumber(owned[0].phone_number);
    });
  }, []);

  const activeLead = leads.find((l) => l.id === activeLeadId) || null;
  const pipelineValue = leads.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);

  const saveCallNote = async (note) => {
    if (!activeLead) return;
    try {
      await api.post("/api/interactions/", {
        lead: activeLead.id,
        type: "CALL",
        direction: "OUTBOUND",
        notes: note,
      });
    } catch {
      /* best-effort */
    }
  };

  return (
    <AppTelnyxProvider>
      <div className="min-h-screen flex flex-col">
        <PipelineHeader leads={leads} pipelineValue={pipelineValue} />
        <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <LeadList leads={leads} activeLeadId={activeLeadId} onSelect={setActiveLeadId} />
          </div>
          <div className="lg:col-span-5 h-[calc(100vh-220px)]">
            <LeadChatPanel lead={activeLead} fromNumber={fromNumber} />
          </div>
          <div className="lg:col-span-4 h-[calc(100vh-220px)]">
            <Dialer activeLead={activeLead} onSaveNote={saveCallNote} />
          </div>
        </div>
      </div>
    </AppTelnyxProvider>
  );
}

function PipelineHeader({ leads, pipelineValue }) {
  return (
    <div className="border-b border-ink-500/50 bg-ink-800/60 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-signal/15 border border-signal/30 text-signal-bright">
            <PhoneCall size={22} />
          </div>
          <div>
            <span className="label-eyebrow">CRM &amp; dialer</span>
            <h1 className="text-2xl font-display font-semibold">Pipeline</h1>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {PIPELINE_ORDER.map((status) => (
            <div key={status} className="text-center">
              <p className="text-[11px] font-mono text-ink-300">{status}</p>
              <p className="font-display text-lg">{leads.filter((l) => l.status === status).length}</p>
            </div>
          ))}
          <div className="text-center pl-4 border-l border-ink-500/50">
            <p className="text-[11px] font-mono text-ink-300 flex items-center gap-1">
              <DollarSign size={11} /> Pipeline
            </p>
            <p className="font-mono text-lg text-amber">{pipelineValue.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadList({ leads, activeLeadId, onSelect }) {
  return (
    <div className="card p-3 h-[calc(100vh-220px)] overflow-y-auto space-y-1.5">
      {leads.map((lead) => (
        <button
          key={lead.id}
          onClick={() => onSelect(lead.id)}
          className={`w-full text-left rounded-xl px-3.5 py-3 transition ${
            lead.id === activeLeadId
              ? "bg-signal/15 border border-signal/40"
              : "hover:bg-ink-600/60 border border-transparent"
          }`}
        >
          <p className="text-sm font-medium text-ink-50 truncate">
            {lead.first_name} {lead.last_name}
          </p>
          <p className="text-[11px] text-ink-300 truncate">{lead.company}</p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wide text-ink-300">{lead.status}</span>
            {lead.deal_value ? (
              <span className="text-[10px] font-mono text-amber">${Number(lead.deal_value).toLocaleString()}</span>
            ) : null}
          </div>
        </button>
      ))}
      {leads.length === 0 && <p className="text-xs text-ink-300 px-2 py-4">No leads yet.</p>}
    </div>
  );
}
