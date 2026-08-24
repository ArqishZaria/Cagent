import { Link } from "react-router-dom";
import SignalBars from "../SignalBars";

export default function PublicFooter() {
  return (
    <footer className="border-t border-ink-500/40 bg-ink-950">
      <div className="max-w-7xl mx-auto px-6 py-14 grid sm:grid-cols-2 md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <SignalBars bars={4} size="sm" color="signal" active={false} />
            <span className="font-display font-semibold text-lg">cagent</span>
          </div>
          <p className="text-sm text-ink-300 leading-relaxed max-w-xs">
            One phone system, one CRM, one place your leads actually get worked.
          </p>
        </div>

        <FooterColumn
          title="Product"
          links={[
            { to: "/pricing", label: "Pricing" },
            { to: "/login", label: "Sign in" },
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            { to: "/about", label: "About" },
            { to: "/contact", label: "Contact" },
          ]}
        />
        <FooterColumn
          title="Get started"
          links={[{ to: "/contact", label: "Start free" }]}
        />
      </div>
      <div className="border-t border-ink-500/30 py-6">
        <p className="text-center text-xs text-ink-300 font-mono">
          © {new Date().getFullYear()} cagent. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <p className="label-eyebrow mb-3">{title}</p>
      <div className="space-y-2">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="block text-sm text-ink-200 hover:text-signal-bright transition"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}