import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Wallet } from "lucide-react";
import api from "../lib/api";
import { useWallet } from "../lib/wallet";
import QRCode from "qrcode.react"

const POLL_MS = 3000;
const PRESETS = [10, 25, 50, 100];

export default function UploadFinancePage() {
  const { wallet, refresh } = useWallet();
  const [amount, setAmount] = useState("25");
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [topup, setTopup] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const loadHistory = () => {
    api.get("/api/wallet/topups/history/").then((res) => setHistory(res.data || []));
  };
  useEffect(loadHistory, []);

  const getQuote = async () => {
    if (!amount || Number(amount) < 2) return;
    setQuoting(true);
    setError("");
    try {
      const res = await api.get("/api/wallet/topups/quote/", { params: { amount } });
      setQuote(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't get a quote for that amount.");
      setQuote(null);
    } finally {
      setQuoting(false);
    }
  };

  const pay = async () => {
    setError("");
    try {
      const res = await api.post("/api/wallet/topups/", { amount_usd: amount });
      setTopup(res.data);
      beginPolling(res.data.id);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't start that payment.");
    }
  };

  const beginPolling = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await api.get(`/api/wallet/topups/${id}/`);
      setTopup(res.data);
      if (res.data.status !== "PENDING") {
        clearInterval(pollRef.current);
        if (res.data.status === "PAID") {
          refresh();
          loadHistory();
        }
      }
    }, POLL_MS);
  };

  const reset = () => {
    setTopup(null);
    setQuote(null);
  };

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
          <h2 className="font-display font-semibold text-lg mb-4 text-ink-900">Top up via Raast</h2>

          {!topup && (
            <>
              <label className="label-eyebrow block mb-1.5">Amount (USD)</label>
              <div className="flex gap-2 mb-3">
                <input
                  className="input-field flex-1"
                  type="number"
                  min="2"
                  step="1"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setQuote(null); }}
                />
                <button onClick={getQuote} disabled={quoting} className="btn-secondary !px-4">
                  {quoting ? <Loader2 size={15} className="animate-spin" /> : "Get quote"}
                </button>
              </div>
              <div className="flex gap-2 mb-5">
                {PRESETS.map((p) => (
                  <button key={p} onClick={() => { setAmount(String(p)); setQuote(null); }}
                          className="btn-ghost !py-1.5 !px-3 text-xs">${p}</button>
                ))}
              </div>

              {quote && (
                <div className="rounded-lg bg-paper-50 border border-paper-200 p-4 mb-5 text-sm space-y-1.5 font-mono">
                  <Row label="Base charge" value={`Rs. ${quote.pkr_base}`} />
                  <Row label="Gateway fee" value={`Rs. ${quote.gateway_fee_pkr}`} />
                  <Row label="Total to pay (Raast)" value={`Rs. ${quote.total_charged_pkr}`} strong />
                  <div className="border-t border-paper-200 my-2" />
                  <Row label="cagent platform fee" value={`$${quote.platform_fee_usd}`} />
                  <Row label="Net credited to wallet" value={`$${quote.net_credited_usd}`} strong />
                </div>
              )}

              {error && <p className="text-xs text-alert mb-4">{error}</p>}

              <button onClick={pay} disabled={!quote} className="btn-amber w-full justify-center !py-3">
                Pay & generate QR
              </button>
            </>
          )}

          {topup && topup.status === "PENDING" && (
            <div className="text-center py-4">
              <p className="text-sm text-ink-600 mb-4">Scan with any banking app (Raast) to complete payment</p>
              <div className="inline-block p-4 bg-white border border-paper-300 rounded-xl mb-3">
                {/* qr_payload is a raw Raast QR string — render via any qrcode lib, e.g. `qrcode.react` */}
                <QRCode value={topup.qr_payload} size={200} />
              </div>
              <p className="font-mono text-sm text-ink-900">Rs. {topup.total_charged_pkr}</p>
              <p className="text-xs text-ink-400 mt-1">Expires {new Date(topup.expires_at).toLocaleTimeString()}</p>
              <Loader2 size={16} className="animate-spin mx-auto mt-4 text-signal" />
            </div>
          )}

          {topup && topup.status === "PAID" && (
            <div className="text-center py-6">
              <CheckCircle2 size={32} className="text-live mx-auto mb-3" />
              <p className="font-display font-semibold text-ink-900">${topup.net_credited_usd} credited</p>
              <a href={`/api/wallet/topups/${topup.id}/invoice/`} className="btn-secondary !py-2 !px-4 text-xs mt-4 inline-flex">
                <Download size={13} /> Download invoice
              </a>
              <button onClick={reset} className="block mx-auto text-xs text-signal hover:underline mt-3">
                Top up again
              </button>
            </div>
          )}

          {topup && ["EXPIRED", "FAILED"].includes(topup.status) && (
            <div className="text-center py-6">
              <AlertTriangle size={28} className="text-alert mx-auto mb-3" />
              <p className="text-sm text-alert">Payment {topup.status.toLowerCase()}.</p>
              <button onClick={reset} className="text-xs text-signal hover:underline mt-3">Try again</button>
            </div>
          )}
        </section>

        <section className="card p-6">
          <h2 className="font-display font-semibold text-lg mb-4 text-ink-900">Invoice history</h2>
          <div className="space-y-2">
            {history.filter((h) => h.status === "PAID").map((h) => (
              <div key={h.id} className="ledger-row !py-3">
                <span>
                  <span className="block text-ink-900">{h.invoice_number}</span>
                  <span className="block text-[11px] text-ink-400">{new Date(h.paid_at).toLocaleString()}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-live">+${h.net_credited_usd}</span>
                  <a href={`/api/wallet/topups/${h.id}/invoice/`} className="text-ink-400 hover:text-signal">
                    <Download size={14} />
                  </a>
                </span>
              </div>
            ))}
            {history.filter((h) => h.status === "PAID").length === 0 && (
              <p className="text-xs text-ink-400 text-center py-8">No top-ups yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between ${strong ? "text-ink-900 font-semibold" : "text-ink-600"}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}