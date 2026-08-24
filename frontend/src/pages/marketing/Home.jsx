import { Link } from "react-router-dom";
import { ArrowRight, MessageSquareText, PhoneCall, Sparkles } from "lucide-react";
import PublicNav from "../../components/marketing/PublicNav";
import PublicFooter from "../../components/marketing/PublicFooter";
import LedgerMockup from "../../components/marketing/LedgerMockup";
import Reveal from "../../components/marketing/Reveal";

export default function MarketingHome() {
  return (
    <div className="min-h-screen bg-paper-50">
      <PublicNav />

      {/* Hero — the ledger mockup is a literal picture of the product: real
          calls and leads, logged in rows, as they happen. */}
      <section className="relative overflow-hidden border-b border-paper-200">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="label-eyebrow inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-paper-300 bg-white">
              Phone system · CRM · AI lead generation
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.08] tracking-tight mb-6 text-ink-900">
              Every call is a lead.
              <br />
              Every lead is <em className="italic text-signal">one number</em> away.
            </h1>
            <p className="text-ink-600 text-lg max-w-lg mb-10 leading-relaxed">
              cagent gives your team a browser-based phone, a CRM that updates itself from every
              call and text, and an AI prospector that finds new leads before your team runs out
              of ones to call.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/contact" className="btn-primary !px-6 !py-3 text-sm">
                Start free <ArrowRight size={16} />
              </Link>
              <Link to="/pricing" className="btn-secondary !px-6 !py-3 text-sm">
                See pricing
              </Link>
            </div>
          </div>

          <LedgerMockup className="max-w-md mx-auto lg:mx-0 lg:ml-auto w-full" />
        </div>
      </section>

      {/* Feature trio */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-6">
          <Reveal delay={0}>
            <FeatureCard
              icon={PhoneCall}
              color="signal"
              title="Dial from the browser"
              description="A real phone built into the CRM. Buy a number, assign it to an agent, and calls start routing — no desk phone, no separate app."
            />
          </Reveal>
          <Reveal delay={100}>
            <FeatureCard
              icon={MessageSquareText}
              color="live"
              title="Texts that stay compliant"
              description="Every conversation lives on the lead's timeline. Reply STOP and cagent locks that contact out automatically — no manual tracking required."
            />
          </Reveal>
          <Reveal delay={200}>
            <FeatureCard
              icon={Sparkles}
              color="amber"
              title="AI finds your next leads"
              description="Describe who you're looking for. cagent searches, qualifies, and hands your team a list of real contacts to call — no spreadsheets involved."
            />
          </Reveal>
        </div>
      </section>

      {/* How it works — genuinely a sequence, so numbering earns its place */}
      <section className="border-y border-paper-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <Reveal>
            <p className="label-eyebrow text-center mb-3">How it works</p>
            <h2 className="font-display text-3xl font-semibold text-center mb-14 text-ink-900">
              From search to closed, in one place
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-8">
            <Reveal delay={0}>
              <Step number="01" title="Search" description="Tell the Prospector who you're looking for. It finds and qualifies real contacts automatically." />
            </Reveal>
            <Reveal delay={100}>
              <Step number="02" title="Connect" description="Call or text straight from the lead's profile. Every interaction logs itself to their timeline." />
            </Reveal>
            <Reveal delay={200}>
              <Step number="03" title="Close" description="Move leads through your pipeline and watch deal value roll up in real time, per agent and per team." />
            </Reveal>
          </div>
        </div>
      </section>

      <Reveal>
        <section className="max-w-4xl mx-auto px-6 py-24 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-5 text-ink-900">
            Give your team a phone that already knows the customer.
          </h2>
          <p className="text-ink-500 mb-8">No setup fees. No contracts. Cancel any time.</p>
          <Link to="/contact" className="btn-primary !px-7 !py-3.5 text-sm inline-flex">
            Start free <ArrowRight size={16} />
          </Link>
        </section>
      </Reveal>

      <PublicFooter />
    </div>
  );
}

function FeatureCard({ icon: Icon, color, title, description }) {
  const colorClasses = {
    signal: "bg-signal/8 border-signal/25 text-signal",
    live: "bg-live/8 border-live/25 text-live",
    amber: "bg-amber/8 border-amber/25 text-amber-dim",
  }[color];

  return (
    <div className="card p-7 hover:shadow-raised-lg hover:-translate-y-0.5 transition duration-300">
      <div className={`inline-flex p-3 rounded-xl border mb-5 ${colorClasses}`}>
        <Icon size={20} />
      </div>
      <h3 className="font-display text-lg font-semibold mb-2 text-ink-900">{title}</h3>
      <p className="text-sm text-ink-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, description }) {
  return (
    <div>
      <p className="font-mono text-sm text-signal mb-3">{number}</p>
      <h3 className="font-display text-lg font-semibold mb-2 text-ink-900">{title}</h3>
      <p className="text-sm text-ink-600 leading-relaxed">{description}</p>
    </div>
  );
}
