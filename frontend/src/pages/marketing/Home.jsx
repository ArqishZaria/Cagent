import { Link } from "react-router-dom";
import { ArrowRight, MessageSquareText, PhoneCall, Sparkles } from "lucide-react";
import PublicNav from "../../components/marketing/PublicNav";
import PublicFooter from "../../components/marketing/PublicFooter";
import SignalMesh3D from "../../components/marketing/SignalMesh3D";
import LiveTicker from "../../components/marketing/LiveTicker";

export default function MarketingHome() {
  return (
    <div className="min-h-screen bg-ink-900">
      <PublicNav />

      {/* Hero — the 3D signal mesh IS the product's thesis: a live network
          of calls and leads moving through the system in real time. */}
      <section className="relative overflow-hidden border-b border-ink-500/40">
        <div className="absolute inset-0">
          <SignalMesh3D className="w-full h-full opacity-80" />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 40%, transparent, rgba(10,14,23,0.55) 70%, #0A0E17 100%)",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          <span className="label-eyebrow inline-block mb-5 px-3 py-1 rounded-full border border-signal/30 bg-signal/10 text-signal-bright">
            Phone system · CRM · AI lead generation
          </span>
          <h1 className="font-display text-4xl sm:text-6xl font-semibold leading-[1.05] tracking-tight mb-6">
            Every call is a lead.
            <br />
            Every lead is one number away.
          </h1>
          <p className="text-ink-200 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Signal gives your team a browser-based phone, a CRM that updates itself from every
            call and text, and an AI prospector that finds new leads before your team runs out
            of ones to call.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Link to="/contact" className="btn-primary !px-6 !py-3 text-sm">
              Start free <ArrowRight size={16} />
            </Link>
            <Link to="/pricing" className="btn-ghost !px-6 !py-3 text-sm">
              See pricing
            </Link>
          </div>

          <div className="max-w-md mx-auto text-left card p-5 bg-ink-800/70 backdrop-blur">
            <p className="label-eyebrow mb-3 text-ink-300">Live on the platform</p>
            <LiveTicker />
          </div>
        </div>
      </section>

      {/* Feature trio — not a numbered sequence, these are three parallel
          capabilities, so no 01/02/03 markers. */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={PhoneCall}
            color="signal"
            title="Dial from the browser"
            description="A real WebRTC phone built into the CRM. Buy a number, assign it to an agent, and calls start routing — no desk phone, no separate app."
          />
          <FeatureCard
            icon={MessageSquareText}
            color="live"
            title="Texts that stay compliant"
            description="Every conversation lives on the lead's timeline. Reply STOP and Signal locks that contact out automatically — no manual tracking required."
          />
          <FeatureCard
            icon={Sparkles}
            color="amber"
            title="AI finds your next leads"
            description="Describe who you're looking for. Signal searches the web, reads the pages, and hands your team a list of real contacts to call."
          />
        </div>
      </section>

      {/* How it works — this genuinely is a sequence, so numbering earns its
          place here. */}
      <section className="border-y border-ink-500/40 bg-ink-800/40">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <p className="label-eyebrow text-center mb-3">How it works</p>
          <h2 className="font-display text-3xl font-semibold text-center mb-14">
            From search to closed, in one place
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <Step number="01" title="Search" description="Tell the Prospector who you're looking for. It searches, reads, and qualifies contacts automatically." />
            <Step number="02" title="Connect" description="Call or text straight from the lead's profile. Every interaction logs itself to their timeline." />
            <Step number="03" title="Close" description="Move leads through your pipeline and watch deal value roll up in real time, per agent and per team." />
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-5">
          Give your team a phone that already knows the customer.
        </h2>
        <p className="text-ink-200 mb-8">No setup fees. No contracts. Cancel any time.</p>
        <Link to="/contact" className="btn-primary !px-7 !py-3.5 text-sm inline-flex">
          Start free <ArrowRight size={16} />
        </Link>
      </section>

      <PublicFooter />
    </div>
  );
}

function FeatureCard({ icon: Icon, color, title, description }) {
  const colorClasses = {
    signal: "bg-signal/15 border-signal/30 text-signal-bright",
    live: "bg-live/15 border-live/30 text-live",
    amber: "bg-amber/15 border-amber/30 text-amber",
  }[color];

  return (
    <div className="card p-7 hover:shadow-raised-lg hover:-translate-y-0.5 transition duration-300">
      <div className={`inline-flex p-3 rounded-xl border mb-5 ${colorClasses}`}>
        <Icon size={20} />
      </div>
      <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-ink-200 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, description }) {
  return (
    <div>
      <p className="font-mono text-sm text-signal-bright mb-3">{number}</p>
      <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-ink-200 leading-relaxed">{description}</p>
    </div>
  );
}