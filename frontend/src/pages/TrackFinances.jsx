import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import api from "../lib/api";
import { useCurrentUser } from "../lib/currentUser";
import PageHeader from "../components/PageHeader";

const TYPE_LABELS = {
  USAGE_CALL: "Calls", USAGE_SMS: "SMS", USAGE_LEAD_SEARCH: "Lead searches",
  USAGE_LEAD_VERIFICATION: "Lead verification", USAGE_NUMBER_RENTAL: "Number rental",
  USAGE_PLATFORM_FEE: "Platform fee", USAGE_OTHER: "Other", TOPUP: "Top-up", ADJUSTMENT: "Adjustment",
};

export default function TrackFinancesPage() {
  const { isAdmin, loading: userLoading } = useCurrentUser();
  const [breakdown, setBreakdown] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    // Company financials are ADMIN-only on the backend too — never even
    // fire these requests for an agent (they'd just 403).
    if (!isAdmin) return;
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    api.get("/api/wallet/transactions/breakdown/", { params }).then((res) => setBreakdown(res.data)).catch(() => {});
    api.get("/api/wallet/transactions/", { params: { ...params, ...(typeFilter ? { type: typeFilter } : {}) } })
      .then((res) => setTransactions(res.data))
      .catch(() => {});
  }, [isAdmin, dateFrom, dateTo, typeFilter]);

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

  if (userLoading) {
    return (
      <div className="min-h-full">
        <PageHeader eyebrow="Usage & spend" title="Usage" />
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-ink-400" size={22} />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-full">
        <PageHeader eyebrow="Usage & spend" title="Usage" />
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <Lock size={22} className="text-ink-400 mx-auto mb-3" />
          <p className="text-sm text-ink-600">
            Company spend and usage details are only visible to your company's Admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <PageHeader eyebrow="Usage & spend" title="Usage" />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {breakdown && (
          <section className="card p-6">
            <h2 className="font-display font-semibold text-sm mb-4 text-ink-900">Spend breakdown</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paper-200">
                  <th className="table-head-cell !py-2 !pr-4">Category</th>
                  <th className="table-head-cell !py-2 text-right">Total spent</th>
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
              <tr className="border-b border-paper-200">
                <th className="table-head-cell !py-2 !pr-3">Date</th>
                <th className="table-head-cell !py-2 !pr-3">Type</th>
                <th className="table-head-cell !py-2 !pr-3">Description</th>
                <th className="table-head-cell !py-2 !pr-3 text-right">Amount</th>
                <th className="table-head-cell !py-2 text-right">Total spent so far</th>
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