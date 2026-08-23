import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquareText, PhoneCall, Sparkles } from "lucide-react";
import PublicNav from "../../components/marketing/PublicNav";
import PublicFooter from "../../components/marketing/PublicFooter";
import SignalMesh3D from "../../components/marketing/SignalMesh3D";
import LiveTicker from "../../components/marketing/LiveTicker";
import Reveal from "../../components/marketing/Reveal";

export default function MarketingHome() {
  const spotlightRef = useRef(null);

  const handleMouseMove = (e) => {
    const el = spotlightRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--spot-x", `${x}%`);
    el.style.setProperty("--spot-y", `${y}%`);
  };

  return (
    <div className="min-h-screen bg-ink-900">
      <PublicNav />

      {/* Hero — the 3D signal mesh is a literal picture of the product:
          calls and leads flowing through a live network. */}
      <section
        ref={spotlightRef}
        onMouseMove={handleMouseMove}
        className="relative overflow-hidden border-b border-ink-500/40"
        style={{ "--spot-x": "50%", "--spot-y": "35%" }}
      >
        <div className="absolute inset-0">
          <SignalMesh3D className="w-full h-full" />
        </div>

        {/* Cursor-reactive glow: brightens the field around the pointer */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-screen opacity-70 transition-opacity"
          style={{
            background:
              "radial-gradient(420px circle at var(--spot-x) var(--spot-y), rgba(124,140,255,0.16), transparent 70%)",
          }}
        />
        {/* Vignette to keep text legible over the scene */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 40%, transparent, rgba(10,14,23,0.6) 72%, #0A0E17 100%)",
          }}
        />
        {/* Subtle grain — keeps the dark field from reading flat */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
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
            cagent gives your team a browser-based phone, a CRM that updates itself from every
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
      <section className="border-y border-ink-500/40 bg-ink-800/40">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <Reveal>
            <p className="label-eyebrow text-center mb-3">How it works</p>
            <h2 className="font-display text-3xl font-semibold text-center mb-14">
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
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-5">
            Give your team a phone that already knows the customer.
          </h2>
          <p className="text-ink-200 mb-8">No setup fees. No contracts. Cancel any time.</p>
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