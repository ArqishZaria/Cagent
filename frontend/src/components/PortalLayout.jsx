import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Building2, ClipboardList, LineChart, PhoneCall, ScrollText, Sparkles, Wallet } from "lucide-react";
import { onPaymentRequired } from "../lib/api";
import PaymentOverdueOverlay from "./PaymentOverdueOverlay";
import useIdleLogout from "../hooks/useIdleLogout";
import AppTelnyxProvider from "../lib/TelnyxProvider";
import CallWidget from "./CallWidget";

const NAV_ITEMS = [
  { to: "/app/prospector", label: "Scraper", icon: Sparkles },
  { to: "/app/leads", label: "Leads List", icon: ClipboardList },
  { to: "/app", label: "CRM & dialer", icon: PhoneCall },
  { to: "/app/call-logs", label: "Call logs", icon: ScrollText },
  { to: "/app/settings", label: "Company settings", icon: Building2 },
  { to: "/app/finance/upload", label: "Upload finance", icon: Wallet },
  { to: "/app/finance/track", label: "Track finances", icon: LineChart },
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
    <nav className="w-16 shrink-0 border-r border-paper-200 bg-white hidden md:flex flex-col items-center py-5 gap-1">
      <div className="w-9 h-9 rounded-lg bg-signal/10 flex items-center justify-center mb-4">
        <span className="w-2 h-2 rounded-full bg-signal" />
      </div>

      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/app"}
          className={({ isActive }) =>
            `group relative flex items-center justify-center w-11 h-11 rounded-lg transition ${
              isActive
                ? "bg-signal/10 text-signal"
                : "text-ink-500 hover:bg-paper-100 hover:text-ink-900"
            }`
          }
        >
          <Icon size={19} strokeWidth={2} />
          <span
            className="pointer-events-none absolute left-full ml-3 whitespace-nowrap
                       rounded-md bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-white
                       opacity-0 scale-95 origin-left
                       group-hover:opacity-100 group-hover:scale-100
                       transition duration-150 z-50 shadow-raised-lg"
          >
            {label}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}