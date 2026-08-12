import { useEffect, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { Building2, PhoneCall, Sparkles } from "lucide-react";
import { onPaymentRequired } from "./lib/api";
import PaymentOverdueOverlay from "./components/PaymentOverdueOverlay";
import CompanySettingsPage from "./pages/CompanySettings";
import AgenticProspectorPage from "./pages/AgenticProspector";
import CrmDialerPage from "./pages/CrmDialerView";

const NAV_ITEMS = [
  { to: "/", label: "CRM & Dialer", icon: PhoneCall },
  { to: "/prospector", label: "Prospector", icon: Sparkles },
  { to: "/settings", label: "Company Settings", icon: Building2 },
];

export default function App() {
  const [overdue, setOverdue] = useState(null); // 402 response body, or null

  useEffect(() => {
    onPaymentRequired((details) => setOverdue(details));
  }, []);

  return (
    <BrowserRouter>
      <div className="flex min-h-screen">
        <SideNav />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<CrmDialerPage />} />
            <Route path="/prospector" element={<AgenticProspectorPage />} />
            <Route path="/settings" element={<CompanySettingsPage />} />
          </Routes>
        </main>
      </div>

      {overdue && <PaymentOverdueOverlay details={overdue} invoice={overdue.invoice} />}
    </BrowserRouter>
  );
}

function SideNav() {
  return (
    <nav className="w-56 shrink-0 border-r border-ink-500/50 bg-ink-800/60 backdrop-blur px-3 py-6 hidden md:flex flex-col gap-1">
      <div className="px-3 mb-6">
        <span className="font-display font-semibold text-lg tracking-tight">Signal</span>
      </div>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
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
