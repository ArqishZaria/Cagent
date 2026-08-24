import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Ban, DollarSign, PhoneOff, Send } from "lucide-react";
import api from "../lib/api";

const STATUS_COLORS = {
  NEW: "bg-ink-100 text-ink-700 border-ink-200",
  CONTACTED: "bg-amber/10 text-amber-dim border-amber/25",
  QUALIFIED: "bg-signal/10 text-signal border-signal/25",
  WON: "bg-live/10 text-live border-live/25",
  LOST: "bg-alert/10 text-alert border-alert/25",
};

/**
 * LeadChatPanel — left side of the CRM/Dialer view: lead profile up top,
 * continuous 2-way SMS thread below. The SMS input is hard-hidden (not just
 * disabled) whenever lead.do_not_contact is true, mirroring the backend's
 * own hard-block in telephony.views.SMSSendView — the UI shouldn't invite an
 * action the server will reject anyway.
 */
export default function LeadChatPanel({ lead, fromNumber }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!lead) return;
    api
      .get("/api/interactions/", { params: { lead: lead.id, type: "SMS" } })
      .then((res) => setMessages(res.data?.results || res.data || []))
      .catch(() => setMessages([]));
  }, [lead?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (!lead) {
    return (
      <div className="card h-full flex items-center justify-center text-sm text-ink-500">
        Select a lead to view their profile and conversation.
      </div>
    );
  }

  const send = async () => {
    const text = draft.trim();
    if (!text || lead.do_not_contact || !fromNumber) return;
    setSending(true);
    setError("");
    try {
      await api.post("/api/telephony/sms/send/", {
        lead_id: lead.id,
        from_number: fromNumber,
        message: text,
      });
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, direction: "OUTBOUND", message_body: text, timestamp: new Date().toISOString() },
      ]);
      setDraft("");
    } catch (err) {
      setError(err.response?.data?.detail || "Message couldn't be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      {/* Lead profile */}
      <div className="p-5 border-b border-paper-200">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-display font-semibold text-lg text-ink-900">
              {lead.first_name} {lead.last_name}
            </h2>
            <p className="text-xs text-ink-500">
              {lead.job_title ? `${lead.job_title} · ` : ""}
              {lead.company}
            </p>
          </div>
          <span className={`text-[11px] font-mono px-2 py-1 rounded-full border ${STATUS_COLORS[lead.status] || STATUS_COLORS.NEW}`}>
            {lead.status}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="font-mono text-ink-800">{lead.phone_number}</span>
          {lead.deal_value && (
            <span className="flex items-center gap-1 font-mono text-amber-dim">
              <DollarSign size={12} />
              {Number(lead.deal_value).toLocaleString()}
            </span>
          )}
          {lead.do_not_contact && (
            <span className="flex items-center gap-1 text-alert">
              <Ban size={12} /> Opted out
            </span>
          )}
        </div>
      </div>

      {/* SMS thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-paper-50/60">
        {messages.length === 0 && <p className="text-xs text-ink-400">No messages yet.</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
              m.direction === "OUTBOUND" ? "bg-signal text-white ml-auto" : "bg-white border border-paper-200 text-ink-800 mr-auto"
            }`}
          >
            {m.message_body}
          </div>
        ))}
      </div>

      {/* Conditional send box — hidden entirely, not just disabled, whenever
          the message genuinely can't go out, rather than leaving an active
          input that silently fails against the backend's own hard-block. */}
      {lead.do_not_contact ? (
        <div className="flex items-center gap-2 px-5 py-4 border-t border-paper-200 bg-alert/5 text-xs text-alert">
          <Ban size={14} />
          This lead replied STOP and can no longer be texted.
        </div>
      ) : !fromNumber ? (
        <div className="flex items-center gap-2 px-5 py-4 border-t border-paper-200 bg-amber/[0.06] text-xs text-ink-700">
          <PhoneOff size={14} className="text-amber-dim shrink-0" />
          <span className="flex-1">No phone number connected — texting needs one to send from.</span>
          <Link to="/app/settings" className="inline-flex items-center gap-1 text-amber-dim font-medium shrink-0 hover:underline">
            Add one <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <div className="p-4 border-t border-paper-200">
          {error && <p className="text-xs text-alert mb-2">{error}</p>}
          <div className="flex items-center gap-2">
            <input
              className="input-field flex-1 !text-sm"
              placeholder="Send a text…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={sending}
            />
            <button onClick={send} disabled={sending || !draft.trim()} className="btn-primary !p-2.5">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
