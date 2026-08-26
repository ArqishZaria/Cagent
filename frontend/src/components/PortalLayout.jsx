import CallWidget from "./CallWidget";
// ...
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