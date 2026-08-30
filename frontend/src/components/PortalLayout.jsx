import { NavLink, Outlet } from "react-router-dom";
import { Building2, ClipboardList, LineChart, PhoneCall, ScrollText, Sparkles, Wallet } from "lucide-react";
import useIdleLogout from "../hooks/useIdleLogout";
import AppTelnyxProvider from "../lib/TelnyxProvider";
import CallWidget from "./CallWidget";
import LowBalanceBanner from "./LowBalanceBanner";
import SupportChatWidget from "./SupportChatWidget";

const NAV_ITEMS = [
  { to: "/app/prospector", label: "Prospector", icon: Sparkles },
  { to: "/app/leads", label: "Leads", icon: ClipboardList },
  { to: "/app", label: "CRM & dialer", icon: PhoneCall },
  { to: "/app/call-logs", label: "Call logs", icon: ScrollText },
  { to: "/app/settings", label: "Settings", icon: Building2 },
  { to: "/app/finance/upload", label: "Billing", icon: Wallet },
  { to: "/app/finance/track", label: "Usage", icon: LineChart },
];

export default function PortalLayout() {
  useIdleLogout();

  return (
    <AppTelnyxProvider>
      <div className="flex min-h-screen bg-paper-50 flex-col">
        <LowBalanceBanner />
        <div className="flex flex-1 min-h-0">
          <SideNav />
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
          <CallWidget />
        </div>
        <SupportChatWidget mode="floating" />
      </div>
    </AppTelnyxProvider>
  );
}

function SideNav() {
  return (
    <nav className="w-60 shrink-0 border-r border-paper-200 bg-white hidden md:flex flex-col py-5">
      <div className="flex items-center gap-2 px-5 mb-6">
        <span className="w-2.5 h-2.5 rounded-full bg-signal" />
        <span className="font-display font-bold text-base text-ink-900">cagent</span>
      </div>

      <div className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/app"}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive
                  ? "bg-signal/10 text-signal"
                  : "text-ink-500 hover:bg-paper-100 hover:text-ink-900"
              }`
            }
          >
            <Icon size={17} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </div>

      <div className="px-5 pt-4 border-t border-paper-200">
        <p className="text-[11px] text-ink-400 font-mono">v1.0 · cagent</p>
      </div>
    </nav>
  );
}