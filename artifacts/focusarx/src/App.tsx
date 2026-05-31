import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@workspace/api-client-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import { CapacitorNativeBridge } from "@/components/CapacitorNativeBridge";
import { GuestBootstrap } from "@/components/GuestBootstrap";
import { SessionRecoveryProvider } from "@/components/SessionRecoveryContext";
import Timer from "@/components/Timer";
import AppShell from "@/components/AppShell";
import CommandPalette from "@/components/CommandPalette";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import MobileWelcomePage, { hasDoneMobileWelcome } from "@/pages/mobile-welcome";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AuthCallbackPage from "@/pages/auth-callback";
import OnboardingPage from "@/pages/onboarding";
import DistractionsPage from "@/pages/distractions";
import ProfilesPage from "@/pages/profiles";
import DashboardPage from "@/pages/dashboard";
import RoadmapPage from "@/pages/roadmap";
import AdminPage from "@/pages/admin";
import LeaderboardPage from "@/pages/leaderboard";
import AchievementsPage from "@/pages/achievements";
import AnalyticsPage from "@/pages/analytics";
import ForgePage from "@/pages/forge";
import FocusDnaPage from "@/pages/focus-dna";
import GhostsPage from "@/pages/ghosts";
import ConsequencesPage from "@/pages/consequences";
import ReplayPage from "@/pages/replay";
import BreathePage from "@/pages/breathe";
import ProfilePage from "@/pages/profile";
import BreakFreePage from "@/pages/break-free";
import { FocusCamera } from "@/components/camera/FocusCamera";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useTasks } from "@/hooks/useTasks";
import ReadinessCheckInModal from "@/components/ReadinessCheckInModal";
import DailyGoal from "@/components/DailyGoal";
import { useEffect, useState } from "react";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import OnboardingModal from "@/components/OnboardingModal";
import HeroBanner from "@/components/HeroBanner";
import FeatureSpotlight from "@/components/FeatureSpotlight";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

function isMobileDevice() {
  return window.innerWidth < 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function MobileWelcomeGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated") return;
    if (hasDoneMobileWelcome()) return;
    if (isMobileDevice()) {
      const path = window.location.pathname;
      const skip = ["/welcome", "/login", "/signup", "/forgot-password", "/reset-password", "/auth", "/admin"];
      if (!skip.some(p => path.startsWith(p))) {
        setLocation("/welcome");
      }
    }
  }, [status, setLocation]);

  return <>{children}</>;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { status } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (status === "unauthenticated") {
      setLocation("/login");
    }
  }, [status, setLocation]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#7C3AED]" />
      </div>
    );
  }

  if (status === "unauthenticated") return null;
  return <Component />;
}

function SidePanel() {
  const { focusSessionsToday } = useSessionHistory();
  const { tasks, activeTasks, toggleDone, addTask } = useTasks();
  const [newTask, setNewTask] = useState("");
  const completedToday = tasks.filter((t) => t.done).length;

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) { addTask(newTask.trim()); setNewTask(""); }
  };

  return (
    <div className="flex flex-col gap-3 w-full lg:w-52 xl:w-56 shrink-0">
      {/* Stats */}
      <div className="rounded-2xl border border-[#1e2130] bg-[#111318] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4a4f62] mb-3">Today's Stats</p>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#5a5f72]">Focus blocks</span>
            <span className="text-xs font-bold text-[#e8eaf0] font-mono">{focusSessionsToday}</span>
          </div>
          <div className="h-[3px] bg-[#1e2130] rounded-full overflow-hidden">
            <div className="h-full bg-[#6c63ff] rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (focusSessionsToday / 8) * 100)}%` }} />
          </div>
          {focusSessionsToday === 0 && (
            <p className="text-[10px] text-[#3a3d4a] italic">You could hit 8 blocks today! 🚀</p>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#5a5f72]">Tasks done</span>
            {tasks.length === 0
              ? <span className="text-[10px] text-[#3a3d4a] italic">Add a task below ↓</span>
              : <span className="text-xs font-bold text-[#22d387] font-mono">{completedToday}/{tasks.length}</span>
            }
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#5a5f72]">Active tasks</span>
            <span className="text-xs font-bold text-[#a5a8ff] font-mono">{activeTasks.length}</span>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="rounded-2xl border border-[#1e2130] bg-[#111318] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4a4f62] mb-3">Tasks</p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {tasks.length === 0 && (
            <p className="text-[11px] text-[#3a3d4a] py-1 italic">✨ Add tasks to unlock your AI Timeline</p>
          )}
          {tasks.slice(0, 6).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleDone(t.id)}
              className="flex items-center gap-2 w-full text-left py-1 group"
            >
              <span className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center transition-all ${t.done ? "bg-[#22d387] border-[#22d387]" : "border-[#2a2d3a] group-hover:border-[#6c63ff]"}`}>
                {t.done && (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </span>
              <span className={`text-xs leading-snug ${t.done ? "line-through text-[#3a3d4a]" : "text-[#6b7080] group-hover:text-[#9095a8]"}`}>{t.title}</span>
            </button>
          ))}
        </div>
        <form onSubmit={handleAddTask} className="mt-3 flex gap-1.5">
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add task…"
            className="flex-1 min-w-0 rounded-lg border border-[#1e2130] bg-[#0d0e14] px-2.5 py-1.5 text-xs text-[#e8eaf0] placeholder-[#3a3d4a] outline-none focus:border-[#6c63ff] transition-colors"
          />
          <button type="submit" className="rounded-lg border border-[#6c63ff]/50 bg-[#6c63ff]/10 px-2.5 py-1.5 text-xs font-semibold text-[#a5a8ff] hover:bg-[#6c63ff]/20 transition-colors">+</button>
        </form>
      </div>

      {/* Daily Goal */}
      <DailyGoal />

      {/* Camera */}
      <div className="rounded-2xl border border-[#1e2130] bg-[#111318] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4a4f62] mb-3">AI Camera</p>
        <FocusCamera />
      </div>
    </div>
  );
}

function HomeTopBar() {
  const { data: session } = useAuth();
  const { focusSessionsToday } = useSessionHistory();
  const user = session?.user;
  const initials = user?.name?.slice(0, 1).toUpperCase() || user?.email?.slice(0, 1).toUpperCase() || "?";

  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#1a1d24] shrink-0">
      <div>
        <p className="text-[10px] font-mono text-[#4a4f62] uppercase tracking-[0.15em]">Deep Work</p>
        <p className="text-lg font-bold text-[#e8eaf0] tracking-tight leading-tight">FocusArx</p>
      </div>
      <div className="flex items-center gap-2">
        {focusSessionsToday > 0 && (
          <span className="flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
            🔥 {focusSessionsToday} today
          </span>
        )}
        {user && !user.isGuest && (
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#a78bfa] flex items-center justify-center text-[11px] font-bold text-white">
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

const MOTIVATIONAL = [
  "Your future self is counting on this session.",
  "One block at a time. That's how legends are built.",
  "The leaderboard is watching. 👀",
  "Distraction is the enemy. You are the weapon.",
  "Every expert was once a beginner who didn't quit.",
  "This session counts. Make it matter.",
];

function MotivationalLine() {
  const line = MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];
  return (
    <p className="text-[11px] italic text-[#3a3d4a] text-center mt-1">{line}</p>
  );
}

function HomePage() {
  function handleHeroStart() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <SessionRecoveryProvider>
      <div className="flex flex-col min-h-[100dvh]">
        <HomeTopBar />
        <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 sm:p-6 overflow-auto">
          {/* Timer card — center on desktop */}
          <div className="flex-1 flex flex-col items-center gap-4">
            <HeroBanner onStart={handleHeroStart} />
            <div className="w-full flex flex-col items-center">
              <Timer />
              <MotivationalLine />
            </div>
            <FeatureSpotlight />
          </div>
          {/* Side panel */}
          <SidePanel />
        </div>
        <ReadinessCheckInModal />
      </div>
    </SessionRecoveryProvider>
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
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <MobileWelcomeGate>
      <AppShell>
        <Switch>
          {/* Mobile welcome — no auth required */}
          <Route path="/welcome" component={MobileWelcomePage} />

          {/* Auth routes — no protection needed */}
          <Route path="/login" component={LoginPage} />
          <Route path="/signup" component={SignupPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/auth/callback" component={AuthCallbackPage} />
          <Route path="/admin" component={AdminPage} />

          {/* Protected routes */}
          <Route path="/" component={HomePage} />
          <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
          <Route path="/analytics" component={() => <ProtectedRoute component={AnalyticsPage} />} />
          <Route path="/leaderboard" component={() => <ProtectedRoute component={LeaderboardPage} />} />
          <Route path="/achievements" component={() => <ProtectedRoute component={AchievementsPage} />} />
          <Route path="/forge" component={() => <ProtectedRoute component={ForgePage} />} />
          <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingPage} />} />
          <Route path="/distractions" component={() => <ProtectedRoute component={DistractionsPage} />} />
          <Route path="/profiles" component={() => <ProtectedRoute component={ProfilesPage} />} />
          <Route path="/roadmap" component={RoadmapPage} />
          <Route path="/focus-dna" component={() => <ProtectedRoute component={FocusDnaPage} />} />
          <Route path="/ghosts" component={() => <ProtectedRoute component={GhostsPage} />} />
          <Route path="/consequences" component={() => <ProtectedRoute component={ConsequencesPage} />} />
          <Route path="/replay" component={() => <ProtectedRoute component={ReplayPage} />} />
          <Route path="/breathe" component={BreathePage} />
          <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
          <Route path="/break-free" component={BreakFreePage} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
      </MobileWelcomeGate>
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
          <WelcomeOverlay />
          <OnboardingModal />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppWithPalette />
          </WouterRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
