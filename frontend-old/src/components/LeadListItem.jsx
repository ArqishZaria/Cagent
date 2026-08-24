import { Building2, DollarSign, Mail, MapPin, MessageSquareText, Phone } from "lucide-react";

const STATUS_COLORS = {
  NEW: "bg-signal/15 text-signal-bright border-signal/30",
  CONTACTED: "bg-amber/15 text-amber border-amber/30",
  QUALIFIED: "bg-live/15 text-live border-live/30",
  WON: "bg-live/20 text-live border-live/40",
  LOST: "bg-ink-500/20 text-ink-200 border-ink-500/40",
};

/**
 * LeadListItem — the one consistent way a lead is displayed anywhere in the
 * app: Prospector results, bulk-upload results, and the CRM's lead list all
 * render leads through this component so the format never diverges again.
 *
 * `compact`: renders a narrower version for the CRM sidebar (name + company
 * + status only). Full mode (default) shows the complete card — company,
 * address/city/state, phone, email — with a "Contact" button.
 *
 * `onSelect`: used by the CRM sidebar — clicking the row selects it as the
 * active lead without navigating anywhere.
 * `onContact`: used by Prospector/bulk-upload results — a dedicated button
 * that jumps to this lead's SMS thread in the CRM.
 */
export default function LeadListItem({ lead, compact = false, active = false, onSelect, onContact }) {
  const name = `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || lead.company || "Unnamed lead";
  const location = [lead.city, lead.state].filter(Boolean).join(", ");

  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={`w-full text-left rounded-xl px-3.5 py-3 transition ${
          active ? "bg-signal/15 border border-signal/40" : "hover:bg-ink-600/60 border border-transparent"
        }`}
      >
        <p className="text-sm font-medium text-ink-50 truncate">{name}</p>
        <p className="text-[11px] text-ink-300 truncate">{lead.company}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border ${STATUS_COLORS[lead.status] || STATUS_COLORS.NEW}`}>
            {lead.status || "NEW"}
          </span>
          {lead.deal_value ? (
            <span className="text-[10px] font-mono text-amber">${Number(lead.deal_value).toLocaleString()}</span>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-semibold text-sm truncate">{name}</p>
          {lead.company && (
            <p className="flex items-center gap-1.5 text-xs text-ink-200 mt-0.5 truncate">
              <Building2 size={12} className="shrink-0" /> {lead.company}
            </p>
          )}
        </div>
        {lead.status && (
          <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[lead.status] || STATUS_COLORS.NEW}`}>
            {lead.status}
          </span>
        )}
      </div>

      <div className="space-y-1.5 pt-2 border-t border-ink-500/40">
        {location && (
          <p className="flex items-center gap-1.5 text-xs text-ink-200">
            <MapPin size={12} className="shrink-0 text-ink-300" /> {location}
          </p>
        )}
        {lead.phone_number && (
          <p className="flex items-center gap-1.5 text-xs font-mono text-ink-100">
            <Phone size={12} className="shrink-0 text-ink-300" /> {lead.phone_number}
          </p>
        )}
        {lead.email && (
          <p className="flex items-center gap-1.5 text-xs font-mono text-ink-100 truncate">
            <Mail size={12} className="shrink-0 text-ink-300" /> {lead.email}
          </p>
        )}
        {lead.deal_value ? (
          <p className="flex items-center gap-1.5 text-xs font-mono text-amber">
            <DollarSign size={12} className="shrink-0" /> {Number(lead.deal_value).toLocaleString()}
          </p>
        ) : null}
      </div>

      {onContact && (
        <button
          onClick={() => onContact(lead)}
          className="btn-primary !py-2 !text-xs justify-center mt-1"
        >
          <MessageSquareText size={13} /> Contact
        </button>
      )}
    </div>
  );
}