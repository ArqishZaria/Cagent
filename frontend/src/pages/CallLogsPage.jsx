import { useEffect, useState } from "react";
import { PhoneIncoming, PhoneMissed, PhoneOutgoing, ScrollText } from "lucide-react";
import api from "../lib/api";

function formatDuration(seconds) {
  const s = Number(seconds) || 0;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

/**
 * CallLogsPage — call history, filterable by which owned number was used.
 * An AGENT already only sees their own interactions (InteractionViewSet's
 * agent_owner_field="user"); an ADMIN sees the whole tenant's calls and can
 * narrow down to one number at a time.
 *
 * Inbound calls auto-declined for insufficient wallet balance are logged
 * with missed=true, duration_seconds=0 (see telephony.views.VoiceWebhookView
 * ._handle_call_initiated) — shown here with a red missed-call icon and a
 * "Missed — low balance" label instead of a duration.
 */
export default function CallLogsPage() {
  const [numbers, setNumbers] = useState([]);
  const [selectedNumberId, setSelectedNumberId] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/telephony/numbers/")
      .then((res) => setNumbers(res.data?.results || res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { type: "CALL" };
    if (selectedNumberId) params.phone_number = selectedNumberId;
    api
      .get("/api/interactions/", { params })
      .then((res) => setLogs(res.data?.results || res.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [selectedNumberId]);

  return (
    <div className="min-h-screen">
      <div className="border-b border-paper-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-signal/8 border border-signal/25 text-signal">
              <ScrollText size={22} />
            </div>
            <div>
              <span className="label-eyebrow">Call history</span>
              <h1 className="text-2xl font-display font-semibold text-ink-900">Call logs</h1>
            </div>
          </div>

          <select
            className="input-field !w-auto !py-2 text-sm"
            value={selectedNumberId}
            onChange={(e) => setSelectedNumberId(e.target.value)}
          >
            <option value="">All numbers</option>
            {numbers.map((n) => (
              <option key={n.id} value={n.id}>
                {n.phone_number}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-sm text-ink-400 text-center py-16">Loading...</p>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-paper-300 rounded-2xl bg-white">
            <p className="text-ink-500 text-sm">No calls logged yet for this number.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {logs.map((log) => (
              <div key={log.id} className="ledger-row !py-3.5 !px-5">
                <span className="flex items-center gap-3 min-w-0">
                  {log.missed ? (
                    <PhoneMissed size={14} className="text-alert shrink-0" />
                  ) : log.direction === "INBOUND" ? (
                    <PhoneIncoming size={14} className="text-live shrink-0" />
                  ) : (
                    <PhoneOutgoing size={14} className="text-signal shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-ink-900 truncate">{log.lead_name || "Unknown lead"}</span>
                    <span className="block text-[11px] text-ink-400">
                      {log.phone_number_display || "—"} · {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </span>
                </span>
                <span className={`shrink-0 ${log.missed ? "text-alert font-medium" : "text-ink-600"}`}>
                  {log.missed ? "Missed — low balance" : formatDuration(log.duration_seconds)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}