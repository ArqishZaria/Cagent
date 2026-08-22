import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import SignalBars from "../SignalBars";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Contact" },
];

export default function PublicNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-500/40 bg-ink-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <SignalBars bars={4} size="sm" color="signal" />
          <span className="font-display font-semibold text-lg tracking-tight">Signal</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? "text-signal-bright bg-signal/10"
                    : "text-ink-200 hover:text-ink-50 hover:bg-ink-600/40"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="btn-ghost !py-2 !px-4 text-sm">
            Sign in
          </Link>
          <Link to="/contact" className="btn-primary !py-2 !px-4 text-sm">
            Start free
          </Link>
        </div>

        <button
          className="md:hidden text-ink-100 p-2"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-ink-500/40 bg-ink-900 px-6 py-4 space-y-1">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm text-ink-100 hover:bg-ink-600/40"
            >
              {link.label}
            </NavLink>
          ))}
          <div className="pt-3 flex gap-2">
            <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost flex-1 justify-center !py-2.5 text-sm">
              Sign in
            </Link>
            <Link to="/contact" onClick={() => setOpen(false)} className="btn-primary flex-1 justify-center !py-2.5 text-sm">
              Start free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}