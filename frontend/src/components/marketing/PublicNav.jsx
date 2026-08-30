import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Contact" },
];

export default function PublicNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled ? "mkt-glass" : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-mkt-green" />
          <span className="font-display font-bold text-lg tracking-tight text-white">Cagent</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/"} className="mkt-nav-link">
              {({ isActive }) => (
                <span className={isActive ? "text-white" : ""}>
                  {link.label}
                  <span
                    className={`absolute left-0 -bottom-1 h-[2px] bg-mkt-green transition-all duration-300 ${
                      isActive ? "w-full" : "w-0"
                    }`}
                  />
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className="mkt-nav-link">Sign in</Link>
          <Link to="/contact" className="mkt-btn-primary !py-2 !px-5 !text-xs">Try for free</Link>
        </div>

        <button className="md:hidden text-white p-2" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-mkt-line bg-mkt-ink px-6 py-5 space-y-1">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/"} onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-mkt-muted hover:text-white hover:bg-white/5">
              {link.label}
            </NavLink>
          ))}
          <div className="pt-3 flex gap-2">
            <Link to="/login" onClick={() => setOpen(false)} className="mkt-btn-secondary flex-1 !py-2.5 text-sm">Sign in</Link>
            <Link to="/contact" onClick={() => setOpen(false)} className="mkt-btn-primary flex-1 !py-2.5 text-sm">Try for free</Link>
          </div>
        </div>
      )}
    </header>
  );
}