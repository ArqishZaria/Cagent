import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import PublicNav from "../../components/marketing/PublicNav";
import PublicFooter from "../../components/marketing/PublicFooter";
import AnnouncementBanner from "../../components/marketing/AnnouncementBanner";

const TIERS = [
  {
    name: "Starter",
    price: "$0",
    period: "/mo + usage",
    description: "For a single agent getting their first numbers online.",
    features: ["1 phone number included", "Browser-based dialer", "SMS with compliance built in", "Basic CRM pipeline"],
    highlighted: false,
  },
  {
    name: "Team",
    price: "$49",
    period: "/agent/mo",
    description: "For teams who live on the phone every day.",
    features: [
      "Unlimited numbers",
      "AI lead prospecting (5 searches/hr)",
      "Full CRM with per-agent visibility",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For larger teams with custom billing and support needs.",
    features: ["Everything in Team", "Custom invoicing terms", "Dedicated onboarding", "SLA-backed support"],
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper-50">
      <AnnouncementBanner />
      <PublicNav />

      <section className="max-w-6xl mx-auto px-6 pt-24 pb-24">
        <div className="text-center mb-16">
          <span className="label-eyebrow inline-block mb-5">Pricing</span>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold mb-4 text-ink-900">
            Simple pricing, no surprises.
          </h1>
          <p className="text-ink-600">Start free. Upgrade when your team is actually using it.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`card p-7 flex flex-col ${
                tier.highlighted ? "border-2 !border-amber relative shadow-raised-lg" : ""
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-7 label-eyebrow px-3 py-1 rounded-full bg-amber text-white">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-xl font-semibold mb-1 text-ink-900">{tier.name}</h3>
              <p className="text-sm text-ink-500 mb-5">{tier.description}</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="font-display text-4xl font-semibold text-ink-900">{tier.price}</span>
                <span className="text-sm text-ink-500">{tier.period}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                    <Check size={16} className="text-live shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/contact"
                className={tier.highlighted ? "btn-amber justify-center !py-3" : "btn-primary justify-center !py-3"}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
