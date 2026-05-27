import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AuthCallbackPage from "@/pages/auth-callback";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import RoadmapPage from "@/pages/roadmap";
import AdminPage from "@/pages/admin";
import LeaderboardPage from "@/pages/leaderboard";
import AchievementsPage from "@/pages/achievements";
import AnalyticsPage from "@/pages/analytics";
import ForgePage from "@/pages/forge";
import { FocusCamera } from "@/components/camera/FocusCamera";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useTasks } from "@/hooks/useTasks";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

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
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#5a5f72]">Tasks done</span>
            <span className="text-xs font-bold text-[#22d387] font-mono">{completedToday}/{tasks.length || 0}</span>
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
            <p className="text-[11px] text-[#3a3d4a] py-1">No tasks yet.</p>
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

function HomePage() {
  return (
    <SessionRecoveryProvider>
      <div className="flex flex-col min-h-[100dvh]">
        <HomeTopBar />
        <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 sm:p-6 overflow-auto">
          {/* Timer card — center on desktop */}
          <div className="flex-1 flex items-start justify-center">
            <Timer />
          </div>
          {/* Side panel */}
          <SidePanel />
        </div>
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
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/onboarding" component={OnboardingPage} />
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
