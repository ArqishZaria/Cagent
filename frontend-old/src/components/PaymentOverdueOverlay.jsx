import { Copy, Lock, Upload } from "lucide-react";
import { useState } from "react";
import SignalBars from "./SignalBars";
import SupportChatWidget from "./SupportChatWidget";

/**
 * PaymentOverdueOverlay
 *
 * Rendered by App.jsx whenever api.js's 402 interceptor fires (tenant is
 * PAID_OVERDUE — see core.middleware.IsSubscriptionActive, Day 2). This is a
 * hard lockout: everything behind it is inert. The only working surface is
 * the embedded Support Chat, which the backend keeps whitelisted specifically
 * so a locked-out tenant can still talk to a human and upload a receipt.
 *
 * `details` is the JSON body from the 402 response
 * ({ detail, code, support_url }) plus optional invoice info the caller
 * fetched separately (amount / invoice_number / due_date).
 */
export default function PaymentOverdueOverlay({ details = {}, invoice = null }) {
  const [copied, setCopied] = useState(null);

  const bankDetails = [
    { label: "Bank", value: "Bank AL Habib" },
    { label: "Account Title", value: import.meta.env?.VITE_BANK_ACCOUNT_TITLE || "Your Company Name" },
    { label: "Account Number", value: import.meta.env?.VITE_BANK_ACCOUNT_NUMBER || "0000-0000000000" },
    { label: "IBAN", value: import.meta.env?.VITE_BANK_IBAN || "PK00ABPA0000000000000000" },
  ];

  const copy = (label, value) => {
    navigator.clipboard?.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Ambient dimmed backdrop — the rest of the app is still visually
          present but inert, reinforcing that this is a lockout, not a modal. */}
      <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-md" />

      {/* Ambient embers of the signal-bars motif, very low opacity, so the
          lockout screen still feels like part of the same product. */}
      <div className="absolute top-10 left-10 opacity-10">
        <SignalBars bars={7} size="lg" color="alert" />
      </div>
      <div className="absolute bottom-10 right-10 opacity-10 rotate-180">
        <SignalBars bars={7} size="lg" color="alert" />
      </div>

      <div className="relative w-full max-w-5xl grid md:grid-cols-5 gap-0 card-raised overflow-hidden animate-fade-up">
        {/* Left: the lockout message + bank transfer instructions */}
        <div className="md:col-span-3 p-8 md:p-10 border-b md:border-b-0 md:border-r border-ink-500/60">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-alert/15 border border-alert/30 text-alert">
              <Lock size={20} />
            </div>
            <span className="label-eyebrow text-alert">Account locked — payment overdue</span>
          </div>

          <h1 className="text-3xl font-display font-semibold mb-2">
            Your workspace is paused.
          </h1>
          <p className="text-ink-200 text-sm mb-8 max-w-md">
            The dialer, CRM, and lead scraper are on hold until your outstanding invoice is
            settled. Support chat stays open the whole time — send us your receipt below and
            we'll restore access.
          </p>

          <div className="flex items-baseline gap-3 mb-8">
            <span className="label-eyebrow">Amount due</span>
            <span className="font-mono text-3xl font-semibold text-alert">
              {invoice?.amount ? `Rs. ${invoice.amount}` : "—"}
            </span>
            {invoice?.due_date && (
              <span className="text-xs text-ink-300 font-mono">was due {invoice.due_date}</span>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="label-eyebrow">Bank AL Habib — IBFT transfer</span>
              {invoice?.invoice_number && (
                <span className="font-mono text-xs text-ink-200">{invoice.invoice_number}</span>
              )}
            </div>
            {bankDetails.map((row) => (
              <div key={row.label} className="flex items-center justify-between group">
                <div>
                  <p className="text-[11px] text-ink-300">{row.label}</p>
                  <p className="font-mono text-sm text-ink-50">{row.value}</p>
                </div>
                <button
                  onClick={() => copy(row.label, row.value)}
                  className="text-ink-300 hover:text-signal transition p-1.5 opacity-0 group-hover:opacity-100"
                  aria-label={`Copy ${row.label}`}
                >
                  <Copy size={14} />
                </button>
              </div>
            ))}
            {copied && <p className="text-[11px] text-live font-mono">{copied} copied</p>}
          </div>

          <div className="flex items-center gap-2 mt-6 text-xs text-ink-300">
            <Upload size={14} />
            <span>After transferring, upload your receipt in the chat on the right.</span>
          </div>
        </div>

        {/* Right: embedded support chat — the one live surface */}
        <div className="md:col-span-2 h-[420px] md:h-auto">
          <SupportChatWidget mode="embedded" />
        </div>
      </div>
    </div>
  );
}
