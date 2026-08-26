import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Building2, ClipboardList, PhoneCall, Sparkles } from "lucide-react";
import { onPaymentRequired } from "../lib/api";
import PaymentOverdueOverlay from "./PaymentOverdueOverlay";
import useIdleLogout from "../hooks/useIdleLogout";
import AppTelnyxProvider from "../lib/TelnyxProvider";

const NAV_ITEMS = [
  { to: "/app", label: "CRM & dialer", icon: PhoneCall },
  { to: "/app/prospector", label: "Prospector", icon: Sparkles },
  { to: "/app/leads", label: "Leads", icon: ClipboardList },
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
      </div>
    </AppTelnyxProvider>
  );
}