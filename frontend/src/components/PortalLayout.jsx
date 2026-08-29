import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Building2, ClipboardList, PhoneCall, ScrollText, Sparkles } from "lucide-react";
import { onPaymentRequired } from "../lib/api";
import PaymentOverdueOverlay from "./PaymentOverdueOverlay";
import useIdleLogout from "../hooks/useIdleLogout";
import AppTelnyxProvider from "../lib/TelnyxProvider";
import CallWidget from "./CallWidget";

const NAV_ITEMS = [
  { to: "/app", label: "CRM & dialer", icon: PhoneCall },
  { to: "/app/prospector", label: "Prospector", icon: Sparkles },
  { to: "/app/leads", label: "Leads", icon: ClipboardList },
  { to: "/app/call-logs", label: "Call logs", icon: ScrollText },
  { to: "/app/settings", label: "Company settings", icon: Building2 },
];

export default function PortalLayout() {
  const [overdue, setOverdue] = useState(null);
  useIdleLogout();

  useEffect(() => {
    onPaymentRequired((details) => setOverdue(details));
  }, []);

  return (
    <AppTelnyxProvider>
      <div className="flex min-h-screen bg-paper-50">
        <SideNav />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
        {overdue && <PaymentOverdueOverlay details={overdue} invoice={overdue.invoice} />}
        <CallWidget />
      </div>
    </AppTelnyxProvider>
  );
}

function SideNav() {
  return (
    <nav className="w-60 shrink-0 border-r border-paper-200 bg-white px-4 py-6 hidden md:flex flex-col gap-1">
      <div className="px-2 mb-8 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-signal" />
        <span className="font-display font-semibold text-lg tracking-tight text-ink-900">
          cagent
        </span>
      </div>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/app"}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition ${
              isActive
                ? "bg-signal/10 text-signal font-medium"
                : "text-ink-600 hover:bg-paper-100 hover:text-ink-900"
            }`
          }
        >
          <Icon size={16} strokeWidth={2} />
          {label}
        </NavLink>
      ))}
      <div className="mt-auto px-3 pt-6 border-t border-paper-200">
        <p className="text-[11px] text-ink-400 font-mono">One phone system.<br />One ledger.</p>
      </div>
    </nav>
  );
}