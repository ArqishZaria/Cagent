import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Building2, ClipboardList, PhoneCall, Sparkles } from "lucide-react";
import { onPaymentRequired } from "../lib/api";
import PaymentOverdueOverlay from "./PaymentOverdueOverlay";
import useIdleLogout from "../hooks/useIdleLogout";

const NAV_ITEMS = [
  { to: "/app", label: "CRM & Dialer", icon: PhoneCall },
  { to: "/app/prospector", label: "Prospector", icon: Sparkles },
  { to: "/app/leads", label: "Leads", icon: ClipboardList },
  { to: "/app/settings", label: "Company Settings", icon: Building2 },
];

export default function PortalLayout() {
  const [overdue, setOverdue] = useState(null);
  useIdleLogout();

  useEffect(() => {
    onPaymentRequired((details) => setOverdue(details));
  }, []);

  return (
    <div className="flex min-h-screen">
      <SideNav />
      <main className="flex-1">
        <Outlet />
      </main>
      {overdue && <PaymentOverdueOverlay details={overdue} invoice={overdue.invoice} />}
    </div>
  );
}

function SideNav() {
  return (
    <nav className="w-56 shrink-0 border-r border-ink-500/50 bg-ink-800/60 backdrop-blur px-3 py-6 hidden md:flex flex-col gap-1">
      <div className="px-3 mb-6">
        <span className="font-display font-semibold text-lg tracking-tight">cagent</span>
      </div>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/app"}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition ${
              isActive ? "bg-signal/15 text-signal-bright border border-signal/30" : "text-ink-200 hover:bg-ink-600/60"
            }`
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}