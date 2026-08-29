import { useEffect, useState } from "react";
import { LineChart } from "lucide-react";
import api from "../lib/api";

const TYPE_LABELS = {
  USAGE_CALL: "Calls", USAGE_SMS: "SMS", USAGE_LEAD_SEARCH: "Lead searches",
  USAGE_NUMBER_RENTAL: "Number rental", USAGE_OTHER: "Other",
};

export default function TrackFinancesPage() {
  const [breakdown, setBreakdown] = useState(null);
  const [rates, setRates] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    api.get("/api/wallet/transactions/breakdown/").then((res) => setBreakdown(res.data));
    api.get("/api/wallet/pricing-rates/").then((res) => setRates(res.data));
    api.get("/api/wallet/transactions/").then((res) => setTransactions(res.data));
  }, []);

  return (
    <div className="min-h-screen">
      <div className="border-b border-paper-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-signal/8 border border-signal/25 text-signal">
            <LineChart size={22} />
          </div>
          <div>
            <span className="label-eyebrow">Usage & spend</span>
            <h1 className="text-2xl font-display font-semibold text-ink-900">Track finances</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {breakdown && (
          <section className="card p-6">
            <h2 className="font-display font-semibold text-sm mb-4 text-ink-900">Spend breakdown</h2>
            <div className="space-y-2 mb-4">
              {breakdown.breakdown.map((row) => (
                <div key={row.type} className="ledger-row !py-2.5">
                  <span>{TYPE_LABELS[row.type] || row.type}</span>
                  <span className="font-mono text-alert">-${row.total_usd}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-paper-200 pt-3 grid sm:grid-cols-3 gap-4 text-sm">
              <div><p className="label-eyebrow">Total top-ups</p><p className="font-mono text-live">${breakdown.total_topups_usd}</p></div>
              <div><p className="label-eyebrow">Total spent</p><p className="font-mono text-alert">${breakdown.total_usage_usd}</p></div>
              <div><p className="label-eyebrow">Current balance</p><p className="font-mono text-ink-900">${breakdown.current_balance_usd}</p></div>
            </div>
          </section>
        )}

        <section className="card p-6">
          <h2 className="font-display font-semibold text-sm mb-4 text-ink-900">Current rates</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {rates.map((r) => (
              <div key={r.key} className="flex justify-between text-sm px-3 py-2 rounded-lg bg-paper-50">
                <span className="text-ink-600">{r.label}</span>
                <span className="font-mono text-ink-900">${r.cost_usd} {r.unit}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-6">
          <h2 className="font-display font-semibold text-sm mb-4 text-ink-900">Recent activity</h2>
          <div className="space-y-1">
            {transactions.map((t) => (
              <div key={t.id} className="ledger-row !py-2.5 !text-xs">
                <span className="truncate">{t.description}</span>
                <span className={`font-mono ${t.amount_usd < 0 ? "text-alert" : "text-live"}`}>
                  {t.amount_usd < 0 ? "-" : "+"}${Math.abs(t.amount_usd)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}