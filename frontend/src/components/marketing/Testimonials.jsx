import Reveal from "./Reveal";

const QUOTES = [
  {
    initials: "DR",
    name: "Dana R.",
    role: "Sales lead, Northside HVAC",
    quote:
      "Our agents used to lose call notes in three different apps. Now a call ends and the follow-up is already sitting on the lead's profile.",
    tone: "signal",
  },
  {
    initials: "MO",
    name: "Marcus O.",
    role: "Owner, Acura Roofing & Solar",
    quote:
      "The Prospector found us forty qualified roofing leads in a slow week. We closed six before the list would've even been built by hand.",
    tone: "amber",
  },
  {
    initials: "SK",
    name: "Sana K.",
    role: "Ops manager, Harborline Freight",
    quote:
      "STOP replies used to be a compliance headache. Now it's automatic, and I can see it happen right on the lead's timeline.",
    tone: "live",
  },
];

const TONE = {
  signal: "bg-signal/10 text-signal",
  amber: "bg-amber/10 text-amber-dim",
  live: "bg-live/10 text-live",
};

export default function Testimonials() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24">
      <Reveal>
        <p className="label-eyebrow text-center mb-3">What teams say</p>
        <h2 className="font-display text-3xl font-semibold text-center mb-14 text-ink-900">
          Fewer tabs, more calls actually worked
        </h2>
      </Reveal>
      <div className="grid md:grid-cols-3 gap-6">
        {QUOTES.map((q, i) => (
          <Reveal key={q.name} delay={i * 100}>
            <figure className="card p-6 h-full flex flex-col">
              <blockquote className="text-ink-700 text-[15px] leading-relaxed flex-1">
                <span className="font-voice italic text-2xl text-ink-300 leading-none block mb-1">&ldquo;</span>
                {q.quote}
              </blockquote>
              <figcaption className="flex items-center gap-3 mt-6 pt-5 border-t border-paper-200">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-semibold shrink-0 ${TONE[q.tone]}`}>
                  {q.initials}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{q.name}</p>
                  <p className="text-xs text-ink-500 truncate">{q.role}</p>
                </div>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
