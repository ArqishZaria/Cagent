import { Copy, Lock, Upload } from "lucide-react";
import { useState } from "react";
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
    { label: "Account title", value: import.meta.env?.VITE_BANK_ACCOUNT_TITLE || "Your Company Name" },
    { label: "Account number", value: import.meta.env?.VITE_BANK_ACCOUNT_NUMBER || "0000-0000000000" },
    { label: "IBAN", value: import.meta.env?.VITE_BANK_IBAN || "PK00ABPA0000000000000000" },
  ];

  const copy = (label, value) => {
    navigator.clipboard?.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" />

      <div className="relative w-full max-w-5xl grid md:grid-cols-5 gap-0 card-raised overflow-hidden animate-fade-up">
        {/* Left: the lockout message + bank transfer instructions */}
        <div className="md:col-span-3 p-8 md:p-10 border-b md:border-b-0 md:border-r border-paper-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-alert/10 border border-alert/25 text-alert">
              <Lock size={20} />
            </div>
            <span className="label-eyebrow text-alert">Account locked — payment overdue</span>
          </div>

          <h1 className="text-3xl font-display font-semibold mb-2 text-ink-900">
            Your workspace is paused.
          </h1>
          <p className="text-ink-600 text-sm mb-8 max-w-md leading-relaxed">
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
              <span className="text-xs text-ink-400 font-mono">was due {invoice.due_date}</span>
            )}
          </div>

          <div className="rounded-xl border border-paper-200 bg-paper-50 p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="label-eyebrow">Bank AL Habib — IBFT transfer</span>
              {invoice?.invoice_number && (
                <span className="font-mono text-xs text-ink-500">{invoice.invoice_number}</span>
              )}
            </div>
            {bankDetails.map((row) => (
              <div key={row.label} className="flex items-center justify-between group">
                <div>
                  <p className="text-[11px] text-ink-400">{row.label}</p>
                  <p className="font-mono text-sm text-ink-900">{row.value}</p>
                </div>
                <button
                  onClick={() => copy(row.label, row.value)}
                  className="text-ink-400 hover:text-signal transition p-1.5 opacity-0 group-hover:opacity-100"
                  aria-label={`Copy ${row.label}`}
                >
                  <Copy size={14} />
                </button>
              </div>
            ))}
            {copied && <p className="text-[11px] text-live font-mono">{copied} copied</p>}
          </div>

          <div className="flex items-center gap-2 mt-6 text-xs text-ink-500">
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
