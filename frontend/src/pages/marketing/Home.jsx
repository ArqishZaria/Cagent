import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Star } from "lucide-react";
import PublicNav from "../../components/marketing/PublicNav";
import PublicFooter from "../../components/marketing/PublicFooter";
import Reveal from "../../components/marketing/Reveal";

const WORDS = ["calling", "texting", "prospecting", "closing"];

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % WORDS.length), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="relative inline-block h-[1.1em] overflow-hidden align-bottom w-[11ch] text-center">
      <span key={i} className="block text-mkt-green animate-word-in">{WORDS[i]}</span>
    </span>
  );
}

function CountUp({ to, decimals = 0, prefix = "", suffix = "" }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const start = performance.now();
        const duration = 1200;
        const tick = (now) => {
          const p = Math.min(1, (now - start) / duration);
          setVal(to * p);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        obs.disconnect();
      },
      { threshold: 0.5 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{prefix}{val.toFixed(decimals)}{suffix}</span>;
}

/** Stands in for a hero video: a fully live, looping call simulation. Now glass. */
function LiveDemoPanel() {
  const LINES = [
    "Dialing +1 512 555 0138…",
    "Connected — 00:02",
    "Lead marked Qualified",
    "Follow-up text sent automatically",
  ];
  const [lineIdx, setLineIdx] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const t1 = setInterval(() => setLineIdx((v) => (v + 1) % LINES.length), 2400);
    const t2 = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="rounded-2xl mkt-glass-card !hover:translate-y-0 p-7 relative overflow-hidden">
      <div
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-mkt-green/[0.12] blur-[80px] pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between mb-8">
        <span className="flex items-center gap-2 text-xs font-mono text-mkt-green">
          <span className="w-1.5 h-1.5 rounded-full bg-mkt-green animate-pulse" />
          LIVE CALL
        </span>
        <span className="font-mono text-xs text-white/40">{mm}:{ss}</span>
      </div>
      <div className="relative flex items-end gap-[3px] h-20 mb-8">
        {Array.from({ length: 32 }).map((_, i) => (
          <span
            key={i}
            className="flex-1 bg-mkt-green/60 rounded-full animate-signal-bar"
            style={{ animationDelay: `${(i % 8) * 0.09}s`, height: "100%" }}
          />
        ))}
      </div>
      <div className="relative h-6 overflow-hidden">
        <p key={lineIdx} className="text-sm text-white/80 font-mono animate-word-in">
          {LINES[lineIdx]}
        </p>
      </div>
    </div>
  );
}

const STORY_STEPS = [
  { tag: "New lead comes in?", title: "Called within minutes", copy: "A lead hits your Prospector results. Your team is already calling from the browser dialer — transcript, duration, and outcome logged automatically." },
  { tag: "Lead gone quiet?", title: "Re-engaged automatically", copy: "Cold leads sitting in the Master pool get resurfaced the next time a teammate searches something similar — no lead ever fully disappears." },
  { tag: "Wallet running low?", title: "Flagged before it's a problem", copy: "One email the moment balance dips, an in-app banner the whole time after — never a surprise mid-call disconnection." },
];

const QUOTES = [
  "Our team stopped losing call notes the day we switched.",
  "Found us 40 qualified roofing leads in a slow week.",
  "STOP replies used to be a compliance headache. Now it's automatic.",
  "Clean, fast, and our reps were productive on day one.",
  "One number, one CRM, way fewer tabs open.",
  "The Prospector alone paid for the platform in a week.",
];

export default function MarketingHome() {
  return (
    <div className="mkt-page min-h-screen">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-mkt-green/[0.08] blur-[120px] pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative max-w-3xl mx-auto px-6 pt-28 pb-16 text-center">
          <Reveal delay={50}>
            <h1 className="font-display font-extrabold text-5xl sm:text-6xl leading-[1.05] tracking-tight mb-8">
              <span className="mkt-heading-gradient">The sales CRM built for</span>
              <br />
              <RotatingWord />
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-mkt-muted text-lg max-w-xl mx-auto mb-9">
              Cagent puts your phone, your texts, and your AI-found leads in one place —
              so your team spends the day talking to people, not switching tabs.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <Link to="/contact" className="mkt-btn-primary">Try for free <ArrowRight size={16} /></Link>
              <Link to="/pricing" className="mkt-btn-secondary">See pricing</Link>
            </div>
          </Reveal>
        </div>

        <Reveal delay={250}>
          <div className="max-w-4xl mx-auto px-6 pb-28">
            <LiveDemoPanel />
          </div>
        </Reveal>
      </section>
      {/* Story steps */}
      <section className="max-w-5xl mx-auto px-6 py-24 border-t border-mkt-line">
        <Reveal>
          <p className="mkt-eyebrow text-center mb-3">Built for conversations</p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-center mb-16 max-w-2xl mx-auto">
            Calling, texting, and pipeline — all working your leads for you
          </h2>
        </Reveal>
        <div className="space-y-5 sm:space-y-6 md:space-y-7">
          {STORY_STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 80}>
              <div className="mkt-glass-card !p-7 sm:!p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center">
                <div>
                  <p className="text-mkt-green font-semibold text-sm mb-2">{step.tag}</p>
                  <h3 className="font-display font-bold text-xl mb-2">{step.title}</h3>
                  <p className="text-mkt-muted text-sm leading-loose max-w-lg">{step.copy}</p>
                </div>
                <CheckCircle2 size={32} className="text-mkt-green/50 shrink-0 hidden md:block" />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Marquee testimonial wall — continuous motion, glass cards */}
      <section className="py-24 border-t border-mkt-line overflow-hidden">
        <Reveal>
          <h2 className="font-display font-bold text-3xl text-center mb-14">Teams can't stop talking about it</h2>
        </Reveal>
        <MarqueeRow items={QUOTES} direction="left" />
        <div className="h-4" />
        <MarqueeRow items={[...QUOTES].reverse()} direction="right" />
      </section>

      {/* Closing CTA */}
      <section className="relative max-w-3xl mx-auto px-6 py-24 text-center border-t border-mkt-line overflow-hidden">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-mkt-green/[0.08] blur-[100px] pointer-events-none"
          aria-hidden="true"
        />
        <Reveal>
          <h2 className="font-display font-bold text-4xl mb-5">Stop missing leads.</h2>
          <p className="text-mkt-muted mb-8">Set up your first number in minutes.</p>
          <Link to="/contact" className="mkt-btn-primary inline-flex">Try for free <ArrowRight size={16} /></Link>
        </Reveal>
      </section>

      <PublicFooter />
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <p className="font-display font-extrabold text-4xl mb-2">{value}</p>
      <p className="text-sm text-mkt-muted">{label}</p>
    </div>
  );
}

function MarqueeRow({ items, direction }) {
  const loop = [...items, ...items];
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div
        className="flex w-max gap-4 animate-marquee"
        style={{ animationDirection: direction === "right" ? "reverse" : "normal", animationDuration: "34s" }}
      >
        {loop.map((q, i) => (
          <div key={i} className="mkt-glass-card !p-5 w-[320px] shrink-0 text-sm text-white/70 leading-relaxed">
            "{q}"
          </div>
        ))}
      </div>
    </div>
  );
}