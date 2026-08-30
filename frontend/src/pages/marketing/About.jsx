import { Link } from "react-router-dom";
import { ArrowRight, Phone, Sparkles, Users } from "lucide-react";
import PublicNav from "../../components/marketing/PublicNav";
import PublicFooter from "../../components/marketing/PublicFooter";
import Reveal from "../../components/marketing/Reveal";
import TeamActivityPanel from "../../components/marketing/TeamActivityPanel";

export default function AboutPage() {
  return (
    <div className="mkt-page min-h-screen">
      <PublicNav />

      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 grid md:grid-cols-2 gap-16 items-center">
        <Reveal>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl mb-6 leading-[1.08]">
            Built by people tired of switching tabs to connect with a{" "}
            <span className="text-mkt-green">customer</span>
          </h1>
          <p className="text-mkt-muted text-lg leading-relaxed">
            Most sales teams run their phone system, their CRM, and their lead lists in three
            different tools that don't talk to each other. cagent puts all three in one place —
            a call updates the CRM automatically, a text thread lives on the lead's profile, and
            new leads show up without anyone opening a spreadsheet.
          </p>
        </Reveal>
        <Reveal delay={150}>
          <TeamActivityPanel />
        </Reveal>
      </section>

      <section className="border-y border-mkt-line bg-mkt-panel/40">
        <div className="max-w-5xl mx-auto px-6 py-20 grid sm:grid-cols-3 gap-8 text-center">
          <Reveal delay={0}><StatBlock icon={Phone} value="1" label="place for calls, texts, and leads" /></Reveal>
          <Reveal delay={100}><StatBlock icon={Sparkles} value="0" label="spreadsheets required" /></Reveal>
          <Reveal delay={200}><StatBlock icon={Users} value="24/7" label="AI prospecting, running in the background" /></Reveal>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <Reveal>
          <h2 className="font-display font-bold text-2xl sm:text-3xl mb-5">
            See it running on your own numbers.
          </h2>
          <Link to="/contact" className="mkt-btn-primary inline-flex">
            Contact Us<ArrowRight size={16} />
          </Link>
        </Reveal>
      </section>

      <PublicFooter />
    </div>
  );
}

function StatBlock({ icon: Icon, value, label }) {
  return (
    <div className="mkt-card !bg-transparent !border-transparent hover:!bg-mkt-panel">
      <Icon size={22} className="text-mkt-green mx-auto mb-3" />
      <p className="font-display text-4xl font-extrabold mb-2">{value}</p>
      <p className="text-sm text-mkt-muted">{label}</p>
    </div>
  );
}