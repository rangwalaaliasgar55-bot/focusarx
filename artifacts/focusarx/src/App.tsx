import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import { CapacitorNativeBridge } from "@/components/CapacitorNativeBridge";
import { GuestBootstrap } from "@/components/GuestBootstrap";
import { PageTransition } from "@/components/PageTransition";
import { SessionRecoveryProvider } from "@/components/SessionRecoveryContext";
import Timer from "@/components/Timer";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import DashboardPage from "@/pages/dashboard";
import RoadmapPage from "@/pages/roadmap";
import AdminPage from "@/pages/admin";
import { Link } from "wouter";

const queryClient = new QueryClient();

function HomePage() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.35),transparent_68%)] blur-2xl" />
        <div className="absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.22),transparent_65%)] blur-2xl" />
        <div className="absolute bottom-0 left-1/3 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_70%)] blur-3xl" />
      </div>
      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center px-4 pb-16 pt-12 sm:pt-16">
        <PageTransition>
          <header className="mb-10 text-center">
            <nav className="mb-6 flex justify-center gap-4 text-xs font-medium text-zinc-500">
              <span className="text-zinc-200">Timer</span>
              <Link href="/dashboard" className="transition-colors hover:text-zinc-200">Dashboard</Link>
              <Link href="/roadmap" className="transition-colors hover:text-zinc-200">AI roadmap</Link>
            </nav>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">Deep work</p>
            <h1 className="mt-2 bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent dark:from-zinc-100 dark:via-zinc-200 dark:to-zinc-500 sm:text-4xl">
              Focusarx
            </h1>
          </header>
          <SessionRecoveryProvider>
            <Timer />
          </SessionRecoveryProvider>
        </PageTransition>
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/roadmap" component={RoadmapPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
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
            <Router />
          </WouterRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
