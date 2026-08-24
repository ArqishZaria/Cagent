import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, DollarSign, PhoneCall, PhoneOff, Sparkles } from "lucide-react";
import api from "../lib/api";
import AppTelnyxProvider from "../lib/TelnyxProvider";
import LeadChatPanel from "../components/LeadChatPanel";
import Dialer from "../components/Dialer";
import LeadListItem from "../components/LeadListItem";

const PIPELINE_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

export default function CrmDialerPage() {
  const [leads, setLeads] = useState([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [fromNumber, setFromNumber] = useState(null);
  const [numbersLoaded, setNumbersLoaded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api
      .get("/api/leads/")
      .then((res) => {
        const data = res.data?.results || res.data || [];
        setLeads(data);
        // If we arrived here via a Prospector "Contact" click, jump straight
        // to that lead's thread. Otherwise default to the first lead.
        const requestedLeadId = location.state?.leadId;
        if (requestedLeadId && data.some((l) => l.id === requestedLeadId)) {
          setActiveLeadId(requestedLeadId);
        } else if (data.length && !activeLeadId) {
          setActiveLeadId(data[0].id);
        }
      })
      .finally(() => setLeadsLoaded(true));

    api
      .get("/api/telephony/numbers/")
      .then((res) => {
        const owned = res.data?.results || res.data || [];
        if (owned.length) setFromNumber(owned[0].phone_number);
      })
      .finally(() => setNumbersLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeLead = leads.find((l) => l.id === activeLeadId) || null;
  const pipelineValue = leads.reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);
  const hasNumber = Boolean(fromNumber);
  const showNoLeadsState = leadsLoaded && leads.length === 0;

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

        {numbersLoaded && !hasNumber && (
          <div className="border-b border-paper-200 bg-amber/[0.06]">
            <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3 text-sm">
              <PhoneOff size={15} className="text-amber-dim shrink-0" />
              <p className="text-ink-700">
                No phone number connected yet — calls and texts need one to go out.
              </p>
              <Link
                to="/app/settings"
                className="inline-flex items-center gap-1 text-amber-dim font-medium hover:underline shrink-0 ml-auto"
              >
                Buy a number <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}

        {showNoLeadsState ? (
          <NoLeadsState />
        ) : (
          <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3">
              <LeadList leads={leads} activeLeadId={activeLeadId} onSelect={setActiveLeadId} />
            </div>
            <div className="lg:col-span-5 h-[calc(100vh-220px)]">
              <LeadChatPanel lead={activeLead} fromNumber={fromNumber} />
            </div>
            <div className="lg:col-span-4 h-[calc(100vh-220px)]">
              <Dialer activeLead={activeLead} onSaveNote={saveCallNote} fromNumber={fromNumber} />
            </div>
          </div>
        )}
      </div>
    </AppTelnyxProvider>
  );
}

function PipelineHeader({ leads, pipelineValue }) {
  return (
    <div className="border-b border-paper-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-signal/8 border border-signal/25 text-signal">
            <PhoneCall size={22} />
          </div>
          <div>
            <span className="label-eyebrow">CRM &amp; dialer</span>
            <h1 className="text-2xl font-display font-semibold text-ink-900">Pipeline</h1>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {PIPELINE_ORDER.map((status) => (
            <div key={status} className="text-center">
              <p className="text-[11px] font-mono text-ink-400">{status}</p>
              <p className="font-display text-lg text-ink-900">{leads.filter((l) => l.status === status).length}</p>
            </div>
          ))}
          <div className="text-center pl-4 border-l border-paper-200">
            <p className="text-[11px] font-mono text-ink-400 flex items-center gap-1">
              <DollarSign size={11} /> Pipeline
            </p>
            <p className="font-mono text-lg text-amber-dim">{pipelineValue.toLocaleString()}</p>
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
        <LeadListItem
          key={lead.id}
          lead={lead}
          compact
          active={lead.id === activeLeadId}
          onSelect={() => onSelect(lead.id)}
        />
      ))}
      {leads.length === 0 && <p className="text-xs text-ink-400 px-2 py-4">No leads yet.</p>}
    </div>
  );
}

/**
 * NoLeadsState — replaces the three-panel layout entirely when the tenant
 * has no leads at all, so a brand-new account sees one clear next step
 * instead of three sparse, half-working panels.
 */
function NoLeadsState() {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-signal/8 border border-signal/25 text-signal flex items-center justify-center mx-auto mb-6">
          <PhoneCall size={24} />
        </div>
        <h2 className="font-display text-2xl font-semibold text-ink-900 mb-2">
          Your pipeline is empty.
        </h2>
        <p className="text-ink-500 text-sm leading-relaxed mb-8">
          Nothing to call or text yet. Find your first leads with the AI Prospector, or open your
          lead list if you've already uploaded some.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/app/prospector" className="btn-amber !px-5">
            <Sparkles size={16} /> Open the Prospector
          </Link>
          <Link to="/app/leads" className="btn-secondary !px-5">
            Browse leads
          </Link>
        </div>
      </div>
    </div>
  );
}
