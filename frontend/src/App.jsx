import { BrowserRouter, Route, Routes } from "react-router-dom";

import MarketingHome from "./pages/marketing/Home";
import AboutPage from "./pages/marketing/About";
import PricingPage from "./pages/marketing/Pricing";
import ContactPage from "./pages/marketing/Contact";
import LoginPage from "./pages/Login";
import ForgotPasswordPage from "./pages/ForgotPassword";

import RequireAuth from "./components/RequireAuth";
import PortalLayout from "./components/PortalLayout";
import CrmDialerPage from "./pages/CrmDialerView";
import AgenticProspectorPage from "./pages/AgenticProspector";
import CompanySettingsPage from "./pages/CompanySettings";
import LeadsPage from "./pages/LeadsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public marketing site */}
        <Route path="/" element={<MarketingHome />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />

        {/* Standalone auth pages — deliberately outside the portal layout,
            so no sidebar or app UI is ever visible before signing in. */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Authenticated portal — everything under /app requires a login
            and renders inside PortalLayout (sidebar + payment-overdue
            overlay + the 5-minute idle-logout timer). */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <PortalLayout />
            </RequireAuth>
          }
        >
          <Route index element={<CrmDialerPage />} />
          <Route path="prospector" element={<AgenticProspectorPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="settings" element={<CompanySettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
