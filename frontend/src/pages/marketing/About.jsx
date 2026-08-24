import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PublicNav from "../../components/marketing/PublicNav";
import PublicFooter from "../../components/marketing/PublicFooter";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-paper-50">
      <PublicNav />

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <span className="label-eyebrow inline-block mb-5">About cagent</span>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold mb-6 leading-tight text-ink-900">
          Built by people tired of switching tabs to talk to a customer.
        </h1>
        <p className="text-ink-600 text-lg leading-relaxed max-w-2xl">
          Most sales teams run their phone system, their CRM, and their lead lists in three
          different tools that don't talk to each other. cagent puts all three in one place — so
          a call updates the CRM automatically, a text thread lives on the lead's profile, and
          new leads show up without anyone opening a spreadsheet.
        </p>
      </section>

      <section className="border-y border-paper-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-20 grid sm:grid-cols-3 gap-8 text-center">
          <StatBlock value="1" label="place for calls, texts, and leads" />
          <StatBlock value="0" label="spreadsheets required" />
          <StatBlock value="24/7" label="AI prospecting, running in the background" />
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-5 text-ink-900">
          See it running on your own numbers.
        </h2>
        <Link to="/contact" className="btn-primary !px-6 !py-3 text-sm inline-flex">
          Talk to us <ArrowRight size={16} />
        </Link>
      </section>

      <PublicFooter />
    </div>
  );
}

function StatBlock({ value, label }) {
  return (
    <div>
      <p className="font-display text-4xl font-semibold text-signal mb-2">{value}</p>
      <p className="text-sm text-ink-600">{label}</p>
    </div>
  );
}
