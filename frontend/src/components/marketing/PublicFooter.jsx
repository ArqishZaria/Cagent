import { Link } from "react-router-dom";

export default function PublicFooter() {
  return (
    <footer className="bg-mkt-ink border-t border-mkt-line">
      <div className="max-w-6xl mx-auto px-6 py-16 grid sm:grid-cols-2 md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-mkt-green" />
            <span className="font-display font-bold text-lg text-white">Cagent</span>
          </div>
          <p className="text-sm text-mkt-muted leading-relaxed max-w-xs">
            One phone system, one CRM, one place your leads actually get worked.
          </p>
        </div>
        <FooterColumn title="Product" links={[{ to: "/pricing", label: "Pricing" }, { to: "/login", label: "Sign in" }]} />
        <FooterColumn title="Company" links={[{ to: "/about", label: "About" }, { to: "/contact", label: "Contact" }]} />
        <FooterColumn title="Get started" links={[{ to: "/contact", label: "Start free" }]} />
      </div>
      <div className="border-t border-mkt-line py-6">
        <p className="text-center text-xs text-mkt-muted font-mono">© {new Date().getFullYear()} cagent. All rights reserved.</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <p className="mkt-eyebrow mb-3">{title}</p>
      <div className="space-y-2">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="block text-sm text-mkt-muted hover:text-white transition">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}