import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import { CapacitorNativeBridge } from "@/components/CapacitorNativeBridge";
import { GuestBootstrap } from "@/components/GuestBootstrap";
import { PageTransition } from "@/components/PageTransition";
import { SessionRecoveryProvider } from "@/components/SessionRecoveryContext";
import Timer from "@/components/Timer";
import AppShell from "@/components/AppShell";
import CommandPalette from "@/components/CommandPalette";
import CoinXPBar from "@/components/CoinXPBar";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import AuthCallbackPage from "@/pages/auth-callback";
import DashboardPage from "@/pages/dashboard";
import RoadmapPage from "@/pages/roadmap";
import AdminPage from "@/pages/admin";
import LeaderboardPage from "@/pages/leaderboard";
import AchievementsPage from "@/pages/achievements";
import AnalyticsPage from "@/pages/analytics";
import ForgePage from "@/pages/forge";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

function HomePage() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.25),transparent_68%)] blur-2xl" />
        <div className="absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_center,rgba(6,214,160,0.12),transparent_65%)] blur-2xl" />
        <div className="absolute bottom-0 left-1/3 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.08),transparent_70%)] blur-3xl" />
      </div>
      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center px-4 pb-16 pt-10 sm:pt-14">
        <PageTransition>
          <header className="mb-8 w-full flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Deep work</p>
              <h1 className="mt-1 bg-gradient-to-br from-[#E2E8F0] via-[#A78BFA] to-[#7C3AED] bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
                FocusArx
              </h1>
            </div>
            <CoinXPBar />
          </header>
          <SessionRecoveryProvider>
            <Timer />
          </SessionRecoveryProvider>
        </PageTransition>
      </main>
    </div>
  );
}

function AppWithPalette() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      // Number shortcuts 1-7 to switch views
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = e.target as HTMLElement;
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <AppShell>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/dashboard" component={DashboardPage} />
          <Route path="/analytics" component={AnalyticsPage} />
          <Route path="/leaderboard" component={LeaderboardPage} />
          <Route path="/achievements" component={AchievementsPage} />
          <Route path="/forge" component={ForgePage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/signup" component={SignupPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/auth/callback" component={AuthCallbackPage} />
          <Route path="/roadmap" component={RoadmapPage} />
          <Route path="/admin" component={AdminPage} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <CapacitorNativeBridge />
          <GuestBootstrap />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppWithPalette />
          </WouterRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
