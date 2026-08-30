import { Link } from "react-router-dom";
import { Check, Phone, MessageSquareText, Sparkles, Wallet } from "lucide-react";
import PublicNav from "../../components/marketing/PublicNav";
import PublicFooter from "../../components/marketing/PublicFooter";
import Reveal from "../../components/marketing/Reveal";

const USAGE_RATES = [
  { icon: Phone, label: "Phone number", price: "$1.50", unit: "/ month" },
  { icon: Phone, label: "Outbound calls", price: "$0.014", unit: "/ min" },
  { icon: Phone, label: "Inbound calls", price: "$0.009", unit: "/ min" },
  { icon: MessageSquareText, label: "Outbound SMS", price: "$0.016", unit: "/ segment" },
  { icon: MessageSquareText, label: "Inbound SMS", price: "$0.008", unit: "/ segment" },
  { icon: Sparkles, label: "Lead search", price: "$2.50", unit: "/ search · up to 25 leads" },
];

const INCLUDED = [
  "Unlimited agent seats",
  "Browser-based dialer & CRM",
  "AI-powered lead prospecting",
  "Full call & SMS history per lead",
  "Priority support",
];

export default function PricingPage() {
  return (
    <div className="mkt-page min-h-screen">
      <PublicNav />

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-14 text-center">
        <Reveal>
          <span className="mkt-eyebrow inline-block mb-5">Pricing</span>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl mb-4">
            <span className="mkt-heading-gradient">One flat fee.</span> Pay only for what you use.
          </h1>
          <p className="text-mkt-muted max-w-xl mx-auto">
            $49/month gets your whole team in. Calls, texts, numbers, and lead searches draw
            from a prepaid wallet — no deposit, no minimums, top up any amount, anytime.
          </p>
        </Reveal>
      </section>

      {/* Subscription + wallet rates, side by side */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid lg:grid-cols-[minmax(0,340px)_1fr] gap-6 items-start">
          {/* Left: subscription card */}
          <Reveal delay={100}>
            <div className="mkt-card !border-mkt-green/50 relative h-full flex flex-col">
              <span className="mkt-eyebrow absolute -top-3 left-7 px-3 py-1 rounded-full bg-mkt-green text-mkt-ink font-bold">
                Platform plan
              </span>
              <div className="flex items-baseline gap-1 mb-2 mt-2">
                <span className="font-display text-5xl font-extrabold">$49</span>
                <span className="text-mkt-muted">/month</span>
              </div>
              <p className="text-sm text-mkt-muted mb-6">
                Everything you need to run your phone system and CRM. Usage is billed
                separately.
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {INCLUDED.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/85">
                    <Check size={16} className="text-mkt-green shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/contact" className="mkt-btn-primary w-full justify-center">
                Get started
              </Link>
            </div>
          </Reveal>

          {/* Right: pay-as-you-go rates */}
          <Reveal delay={180}>
            <div className="mkt-card !p-0 overflow-hidden hover:!translate-y-0 h-full flex flex-col">
              <div className="flex items-center gap-2 px-6 pt-6 pb-4">
                <Wallet size={16} className="text-mkt-green" />
                <h2 className="font-display font-bold text-lg">Pay-as-you-go wallet rates</h2>
              </div>
              <div className="flex-1">
                {USAGE_RATES.map((row, i) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between gap-4 px-6 py-4 ${
                      i !== USAGE_RATES.length - 1 ? "border-b border-mkt-line" : ""
                    } hover:bg-mkt-panelHover transition`}
                  >
                    <span className="flex items-center gap-3 text-sm text-white/85">
                      <row.icon size={16} className="text-mkt-green shrink-0" />
                      {row.label}
                    </span>
                    <span className="font-mono text-sm text-white text-right shrink-0">
                      {row.price} <span className="text-mkt-muted">{row.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Supporting notes below both columns */}
        <Reveal delay={260}>
          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <div className="mkt-card !p-5 text-sm text-mkt-muted">
              <span className="text-white font-medium block mb-1">No deposit fee</span>
              Load your wallet for free — we only deduct as you actually call, text, or search.
            </div>
            <div className="mkt-card !p-5 text-sm text-mkt-muted">
              <span className="text-white font-medium block mb-1">Zero-lead searches are free</span>
              If a Prospector search turns up nothing, your wallet isn't charged.
            </div>
          </div>
        </Reveal>

        <Reveal delay={320}>
          <p className="text-xs text-mkt-muted text-center mt-8">
            SMS is billed per 160-character segment — a longer text that spans two segments is
            billed at 2× the per-segment rate.
          </p>
        </Reveal>
      </section>

      <PublicFooter />
    </div>
  );
}