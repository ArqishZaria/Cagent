import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Building2, ChevronDown, ClipboardList, LifeBuoy, LineChart, LogOut,
  PhoneCall, ScrollText, Sparkles, UserCircle, Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useIdleLogout from "../hooks/useIdleLogout";
import AppTelnyxProvider from "../lib/TelnyxProvider";
import { logout } from "../lib/auth";
import { useCurrentUser } from "../lib/currentUser";
import CallWidget from "./CallWidget";
import LowBalanceBanner from "./LowBalanceBanner";
import PlatformFeeOverdueBanner from "./PlatformFeeOverdueBanner";

// adminOnly: hidden from AGENT users. The backend enforces the same rule
// (wallet.views.TransactionListView / TransactionBreakdownView are
// IsTenantAdmin) — hiding the link is just so agents don't land on a page
// that can only tell them "admins only".
const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { to: "/app", label: "CRM & Dialer", icon: PhoneCall, end: true },
      { to: "/app/leads", label: "Leads", icon: ClipboardList },
      { to: "/app/prospector", label: "Prospector", icon: Sparkles },
      { to: "/app/call-logs", label: "Call Logs", icon: ScrollText },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/app/finance/upload", label: "Billing", icon: Wallet },
      { to: "/app/finance/track", label: "Usage", icon: LineChart, adminOnly: true },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/app/settings", label: "Company Settings", icon: Building2 },
      { to: "/app/support", label: "Support", icon: LifeBuoy },
      { to: "/app/profile", label: "Profile", icon: UserCircle },
    ],
  },
];

const PAGE_TITLES = {
  "/app": "CRM & Dialer",
  "/app/leads": "Leads",
  "/app/prospector": "Prospector",
  "/app/call-logs": "Call Logs",
  "/app/finance/upload": "Billing",
  "/app/finance/track": "Usage",
  "/app/settings": "Company Settings",
  "/app/support": "Support",
  "/app/profile": "Profile",
};

export default function PortalLayout() {
  useIdleLogout();

  return (
    <AppTelnyxProvider>
      {/* Locked to the viewport height — nothing here scrolls except the
          nav list and the page content, so the chrome stays fixed. */}
      <div className="h-screen overflow-hidden bg-paper-50 flex flex-col">
        <PlatformFeeOverdueBanner />
        <LowBalanceBanner />
        <div className="flex flex-1 min-h-0">
          <SideNav />
          <div className="flex-1 min-w-0 flex flex-col">
            <TopBar />
            <main className="flex-1 min-h-0 overflow-y-auto">
              <Outlet />
            </main>
          </div>
          <CallWidget />
        </div>
      </div>
    </AppTelnyxProvider>
  );
}

function SideNav() {
  const { isAdmin } = useCurrentUser();

  return (
    <nav className="w-64 shrink-0 border-r border-paper-200 bg-white hidden md:flex flex-col py-5 h-full">
      <div className="flex items-center gap-2.5 px-5 mb-7 shrink-0">
        <span className="w-7 h-7 rounded-md bg-signal flex items-center justify-center text-white font-display font-semibold text-xs">
          C
        </span>
        <span className="font-display font-semibold text-[15px] text-ink-900 tracking-tight">Cagent</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-400">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items
                .filter((item) => !item.adminOnly || isAdmin)
                .map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] font-medium transition ${
                        isActive
                          ? "bg-signal/8 text-signal"
                          : "text-ink-600 hover:bg-paper-100 hover:text-ink-900"
                      }`
                    }
                  >
                    <Icon size={16} strokeWidth={2} />
                    {label}
                  </NavLink>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 pt-4 mt-3 border-t border-paper-200 shrink-0">
        <p className="text-[11px] text-ink-400 font-mono">v1.01.01 · Cagent</p>
      </div>
    </nav>
  );
}

function TopBar() {
  const { user, isAdmin } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const title = PAGE_TITLES[location.pathname] || "Cagent";

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="h-14 shrink-0 border-b border-paper-200 bg-white flex items-center justify-between px-6">
      <h1 className="font-display font-semibold text-[15px] text-ink-900">{title}</h1>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-paper-100 transition"
        >
          <span className="w-7 h-7 rounded-full bg-ink-100 flex items-center justify-center text-[11px] font-mono font-semibold text-ink-700 shrink-0">
            {(user?.username || "?").slice(0, 2).toUpperCase()}
          </span>
          <span className="text-sm text-ink-700 hidden sm:inline max-w-[140px] truncate">
            {user?.username}
          </span>
          <ChevronDown size={14} className={`text-ink-400 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-paper-200 rounded-lg shadow-raised-lg py-1 z-20 animate-fade-up">
            <div className="px-3 py-2 border-b border-paper-100">
              <p className="text-sm text-ink-900 font-medium truncate">{user?.username}</p>
              <p className="text-[11px] text-ink-400">{isAdmin ? "Admin (Boss)" : "Agent"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-600 hover:bg-paper-50 hover:text-alert transition"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}