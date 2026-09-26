import { useEffect, useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import api from "../lib/api";

const TYPE_LABELS = {
  USAGE_CALL: "Calls", USAGE_SMS: "SMS", USAGE_LEAD_SEARCH: "Lead searches",
  USAGE_LEAD_VERIFICATION: "Lead verification", USAGE_NUMBER_RENTAL: "Number rental",
  USAGE_PLATFORM_FEE: "Platform fee", USAGE_OTHER: "Other", TOPUP: "Top-up", ADJUSTMENT: "Adjustment",
};

export default function TrackFinancesPage() {
  const [breakdown, setBreakdown] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    api.get("/api/wallet/transactions/breakdown/", { params }).then((res) => setBreakdown(res.data));
    api.get("/api/wallet/transactions/", { params: { ...params, ...(typeFilter ? { type: typeFilter } : {}) } })
      .then((res) => setTransactions(res.data));
  }, [dateFrom, dateTo, typeFilter]);

  const rows = useMemo(() => {
    const ascending = [...transactions].reverse();
    let cumulativeUsage = 0;
    return ascending
      .map((t) => {
        if (t.type !== "TOPUP" && t.type !== "ADJUSTMENT") cumulativeUsage += Math.abs(Number(t.amount_usd));
        return { ...t, cumulativeUsage };
      })
      .reverse();
  }, [transactions]);

  return (
    <div className="min-h-screen">
      <div className="border-b border-paper-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-signal/8 border border-signal/25 text-signal"><LineChart size={22} /></div>
          <div>
            <span className="label-eyebrow">Usage & spend</span>
            <h1 className="text-2xl font-display font-semibold text-ink-900">Track finances</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {breakdown && (
          <section className="card p-6">
            <h2 className="font-display font-semibold text-sm mb-4 text-ink-900">Spend breakdown</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paper-200 text-left">
                  <th className="py-2 pr-4 text-[11px] font-mono uppercase tracking-wide text-ink-500">Category</th>
                  <th className="py-2 text-[11px] font-mono uppercase tracking-wide text-ink-500 text-right">Total spent</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.breakdown.map((row) => (
                  <tr key={row.type} className="border-b border-paper-100 last:border-b-0">
                    <td className="py-2.5 pr-4">{TYPE_LABELS[row.type] || row.type}</td>
                    <td className="py-2.5 font-mono text-alert text-right">-${row.total_usd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-paper-200 pt-3 mt-3 grid sm:grid-cols-3 gap-4 text-sm">
              <div><p className="label-eyebrow">Total top-ups</p><p className="font-mono text-live">${breakdown.total_topups_usd}</p></div>
              <div><p className="label-eyebrow">Total spent</p><p className="font-mono text-alert">${breakdown.total_usage_usd}</p></div>
              <div><p className="label-eyebrow">Current balance</p><p className="font-mono text-ink-900">${breakdown.current_balance_usd}</p></div>
            </div>
          </section>
        )}

        <section className="card p-6">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <h2 className="font-display font-semibold text-sm text-ink-900 mr-auto">Activity</h2>
            <div><label className="label-eyebrow block mb-1">From</label>
              <input type="date" className="input-field !py-1.5 !text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
            <div><label className="label-eyebrow block mb-1">To</label>
              <input type="date" className="input-field !py-1.5 !text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
            <div><label className="label-eyebrow block mb-1">Type</label>
              <select className="input-field !py-1.5 !text-xs" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All</option>
                {Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-200 text-left">
                <th className="py-2 pr-3 text-[11px] font-mono uppercase tracking-wide text-ink-500">Date</th>
                <th className="py-2 pr-3 text-[11px] font-mono uppercase tracking-wide text-ink-500">Type</th>
                <th className="py-2 pr-3 text-[11px] font-mono uppercase tracking-wide text-ink-500">Description</th>
                <th className="py-2 pr-3 text-[11px] font-mono uppercase tracking-wide text-ink-500 text-right">Amount</th>
                <th className="py-2 text-[11px] font-mono uppercase tracking-wide text-ink-500 text-right">Total spent so far</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-paper-100 last:border-b-0">
                  <td className="py-2 pr-3 text-ink-500 text-xs whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-xs">{TYPE_LABELS[t.type] || t.type}</td>
                  <td className="py-2 pr-3 truncate max-w-[220px]">{t.description}</td>
                  <td className={`py-2 pr-3 font-mono text-right ${t.amount_usd < 0 ? "text-alert" : "text-live"}`}>
                    {t.amount_usd < 0 ? "-" : "+"}${Math.abs(t.amount_usd)}
                  </td>
                  <td className="py-2 font-mono text-right text-ink-700">${t.cumulativeUsage.toFixed(4)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-ink-400 text-xs">No activity in this range.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}