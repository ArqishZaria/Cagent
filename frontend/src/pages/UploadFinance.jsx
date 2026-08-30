import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, Wallet } from "lucide-react";
import api from "../lib/api";
import { useWallet } from "../lib/wallet";

function CopyableRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex items-center justify-between rounded-lg bg-paper-50 border border-paper-200 px-4 py-3">
      <div>
        <p className="label-eyebrow">{label}</p>
        <p className="font-mono text-sm text-ink-900">{value}</p>
      </div>
      <button onClick={copy} className="btn-ghost !p-2" aria-label={`Copy ${label}`}>
        {copied ? <Check size={15} className="text-live" /> : <Copy size={15} />}
      </button>
    </div>
  );
}

export default function UploadFinancePage() {
  const { wallet, refresh } = useWallet();
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [recentTopups, setRecentTopups] = useState([]);

  useEffect(() => {
    api.get("/api/wallet/manual-payment-info/").then((res) => setPaymentInfo(res.data));
    api
      .get("/api/wallet/transactions/", { params: { type: "TOPUP" } })
      .then((res) => setRecentTopups(res.data || []));
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen">
      <div className="border-b border-paper-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber/8 border border-amber/25 text-amber-dim">
              <Wallet size={22} />
            </div>
            <div>
              <span className="label-eyebrow">Prepaid wallet</span>
              <h1 className="text-2xl font-display font-semibold text-ink-900">Upload finance</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="label-eyebrow">Current balance</p>
            <p className="font-mono text-2xl font-semibold text-ink-900">
              ${wallet ? Number(wallet.balance_usd).toFixed(2) : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="font-display font-semibold text-lg mb-2 text-ink-900">How to top up</h2>
          <p className="text-sm text-ink-500 mb-5">
            {paymentInfo?.instructions ||
              "Transfer any amount to the account below, then send a screenshot of the confirmation in Support Chat."}
          </p>

          <div className="space-y-2 mb-5">
            <CopyableRow label="Bank" value={paymentInfo?.bank_name} />
            <CopyableRow label="Account title" value={paymentInfo?.account_title} />
            <CopyableRow label="Account number" value={paymentInfo?.account_number} />
            <CopyableRow label="IBAN" value={paymentInfo?.iban} />
            <CopyableRow label="SadaPay" value={paymentInfo?.sadapay_number} />
          </div>

          <div className="flex items-start gap-2.5 rounded-lg bg-signal/5 border border-signal/20 px-4 py-3 text-sm text-ink-700">
            <MessageCircle size={16} className="text-signal shrink-0 mt-0.5" />
            <span>
              Once transferred, click the chat bubble in the bottom-right corner, attach your
              screenshot, and include your company name. We'll credit your wallet shortly after.
            </span>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="font-display font-semibold text-lg mb-4 text-ink-900">Recent top-ups</h2>
          <div className="space-y-2">
            {recentTopups.map((t) => (
              <div key={t.id} className="ledger-row !py-3">
                <span>
                  <span className="block text-ink-900">{t.description}</span>
                  <span className="block text-[11px] text-ink-400">
                    {new Date(t.created_at).toLocaleString()}
                  </span>
                </span>
                <span className="font-mono text-live">+${Number(t.amount_usd).toFixed(2)}</span>
              </div>
            ))}
            {recentTopups.length === 0 && (
              <p className="text-xs text-ink-400 text-center py-8">No top-ups yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}