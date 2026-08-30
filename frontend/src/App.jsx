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
import CallLogsPage from "./pages/CallLogsPage";
import UploadFinancePage from "./pages/UploadFinance";
import TrackFinancesPage from "./pages/TrackFinances";
import ProfilePage from "./pages/ProfilePage";
import SupportPage from "./pages/SupportPage";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MarketingHome />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="profile" element={<ProfilePage />} />

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
          <Route path="call-logs" element={<CallLogsPage />} />
          <Route path="settings" element={<CompanySettingsPage />} />
          <Route path="finance/upload" element={<UploadFinancePage />} />
          <Route path="finance/track" element={<TrackFinancesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}