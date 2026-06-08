import { lazy, Suspense, useEffect, useState } from "react";
import MissionsWidget from "@/components/MissionsWidget";
import ProductivityScoreWidget from "@/components/ProductivityScoreWidget";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@workspace/api-client-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import { CapacitorNativeBridge } from "@/components/CapacitorNativeBridge";
import { GuestBootstrap } from "@/components/GuestBootstrap";
import { SiteAnalyticsTracker } from "@/components/SiteAnalyticsTracker";
import { SessionRecoveryProvider } from "@/components/SessionRecoveryContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import AdminPage from "@/pages/admin";
import { FocusCamera } from "@/components/camera/FocusCamera";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useTasks } from "@/hooks/useTasks";
import ReadinessCheckInModal from "@/components/ReadinessCheckInModal";
import DailyGoal from "@/components/DailyGoal";
import MissedTaskReview, { useMissedTaskReview } from "@/components/MissedTaskReview";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import OnboardingModal from "@/components/OnboardingModal";
import HeroBanner from "@/components/HeroBanner";
import FeatureSpotlight from "@/components/FeatureSpotlight";

const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const DistractionsPage = lazy(() => import("@/pages/distractions"));
const ProfilesPage = lazy(() => import("@/pages/profiles"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const RoadmapPage = lazy(() => import("@/pages/roadmap"));
const LeaderboardPage = lazy(() => import("@/pages/leaderboard"));
const AchievementsPage = lazy(() => import("@/pages/achievements"));
const AnalyticsPage = lazy(() => import("@/pages/analytics"));
const ForgePage = lazy(() => import("@/pages/forge"));
const FocusDnaPage = lazy(() => import("@/pages/focus-dna"));
const GhostsPage = lazy(() => import("@/pages/ghosts"));
const ConsequencesPage = lazy(() => import("@/pages/consequences"));
const ReplayPage = lazy(() => import("@/pages/replay"));
const BreathePage = lazy(() => import("@/pages/breathe"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const BreakFreePage = lazy(() => import("@/pages/break-free"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const CookiePolicyPage = lazy(() => import("@/pages/cookie-policy"));
const AcceptableUsePage = lazy(() => import("@/pages/acceptable-use"));
const AiPolicyPage = lazy(() => import("@/pages/ai-policy"));
const DataDeletionPage = lazy(() => import("@/pages/data-deletion"));
const PricingPage = lazy(() => import("@/pages/pricing"));
const MissionsPage = lazy(() => import("@/pages/missions"));
const SocialPage = lazy(() => import("@/pages/social"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const GroupsPage = lazy(() => import("@/pages/groups"));
const BattlePassPage = lazy(() => import("@/pages/battle-pass"));
const AiInsightsPage = lazy(() => import("@/pages/ai-insights"));
const UserProfilePage = lazy(() => import("@/pages/user-profile"));
const HabitsPage = lazy(() => import("@/pages/habits"));
const MessagesPage = lazy(() => import("@/pages/messages"));
const ShopPage = lazy(() => import("@/pages/shop"));
const GoalsPage = lazy(() => import("@/pages/goals"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false;
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
      if (!skip.some(p => path.startsWith(p))) setLocation("/welcome");
    }
  }, [status, setLocation]);
  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading page">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.15)] border-t-[#7C3AED]" />
          <div className="absolute inset-2 animate-ping rounded-full bg-[rgba(124,58,237,0.25)]" style={{ animationDuration: "1.4s" }} />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-widest text-[#374151]">Loading…</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { status } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (status === "unauthenticated") setLocation("/login");
  }, [status, setLocation]);
  if (status === "loading") return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#7C3AED]" />
    </div>
  );
  if (status === "unauthenticated") return null;
  return <Component />;
}

function SidePanel() {
  const { focusSessionsToday } = useSessionHistory();
  const { tasks, activeTasks, completedTasks, toggleDone, addTask } = useTasks();
  const [newTask, setNewTask] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const { showReview, missedTasks, dismiss } = useMissedTaskReview();

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) { addTask(newTask.trim()); setNewTask(""); }
  };

  return (
    <div className="flex flex-col gap-3 w-full lg:w-52 xl:w-56 shrink-0">
      {/* Missed Task Review modal — fires once per day if there are unreviewed tasks */}
      <MissedTaskReview open={showReview} tasks={missedTasks} onDone={dismiss} />

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
              : <span className="text-xs font-bold text-[#22d387] font-mono">{completedTasks.length}/{tasks.length}</span>
            }
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#5a5f72]">Active tasks</span>
            <span className="text-xs font-bold text-[#a5a8ff] font-mono">{activeTasks.length}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#1e2130] bg-[#111318] p-4">
        {/* Active Tasks */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4a4f62] mb-2">Active Tasks</p>
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {activeTasks.length === 0 && (
            <p className="text-[11px] text-[#3a3d4a] py-1 italic">✨ Add tasks to unlock your AI Timeline</p>
          )}
          {activeTasks.slice(0, 6).map((t) => (
            <button key={t.id} type="button" onClick={() => toggleDone(t.id)} className="flex items-center gap-2 w-full text-left py-1 group">
              <span className="w-3.5 h-3.5 rounded-full border border-[#2a2d3a] shrink-0 flex items-center justify-center transition-all group-hover:border-[#6c63ff]" />
              <span className="text-xs leading-snug text-[#6b7080] group-hover:text-[#9095a8]">{t.title}</span>
            </button>
          ))}
          {activeTasks.length > 6 && (
            <p className="text-[10px] text-[#3a3d4a] pl-5">+{activeTasks.length - 6} more</p>
          )}
        </div>

        {/* Completed Tasks — collapsible section */}
        {completedTasks.length > 0 && (
          <div className="mt-3 border-t border-[#1a1d27] pt-2">
            <button
              type="button"
              onClick={() => setShowCompleted(v => !v)}
              className="flex items-center gap-1.5 w-full text-left group"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3a3d4a] group-hover:text-[#5a5f72] transition-colors">
                Completed ({completedTasks.length})
              </span>
              <span className={`ml-auto text-[10px] text-[#3a3d4a] transition-transform duration-150 ${showCompleted ? "rotate-180" : ""}`}>▾</span>
            </button>
            {showCompleted && (
              <div className="space-y-1 mt-1.5 max-h-28 overflow-y-auto">
                {completedTasks.slice(0, 5).map((t) => (
                  <button key={t.id} type="button" onClick={() => toggleDone(t.id)} className="flex items-center gap-2 w-full text-left py-0.5 group">
                    <span className="w-3.5 h-3.5 rounded-full border bg-[#22d387] border-[#22d387] shrink-0 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    <span className="text-xs leading-snug line-through text-[#3a3d4a] group-hover:text-[#4a4f62]">{t.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleAddTask} className="mt-3 flex gap-1.5">
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add task…" className="flex-1 min-w-0 rounded-lg border border-[#1e2130] bg-[#0d0e14] px-2.5 py-1.5 text-xs text-[#e8eaf0] placeholder-[#3a3d4a] outline-none focus:border-[#6c63ff] transition-colors" />
          <button type="submit" className="rounded-lg border border-[#6c63ff]/50 bg-[#6c63ff]/10 px-2.5 py-1.5 text-xs font-semibold text-[#a5a8ff] hover:bg-[#6c63ff]/20 transition-colors">+</button>
        </form>
      </div>

      <DailyGoal />
      <ProductivityScoreWidget />
      <MissionsWidget />

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
  return <p className="text-[11px] italic text-[#3a3d4a] text-center mt-1">{line}</p>;
}

function HomePage() {
  function handleHeroStart() { window.scrollTo({ top: 0, behavior: "smooth" }); }
  return (
    <SessionRecoveryProvider>
      <div className="flex flex-col min-h-[100dvh]">
        <HomeTopBar />
        <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 sm:p-6 overflow-auto">
          <div className="flex-1 flex flex-col items-center gap-4">
            <HeroBanner onStart={handleHeroStart} />
            <div className="w-full flex flex-col items-center">
              <Timer />
              <MotivationalLine />
            </div>
            <FeatureSpotlight />
          </div>
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
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <MobileWelcomeGate>
        <AppShell>
          <Suspense fallback={<PageLoader />}>
            <Switch>
              <Route path="/welcome" component={MobileWelcomePage} />
              <Route path="/login" component={LoginPage} />
              <Route path="/signup" component={SignupPage} />
              <Route path="/forgot-password" component={ForgotPasswordPage} />
              <Route path="/reset-password" component={ResetPasswordPage} />
              <Route path="/auth/callback" component={AuthCallbackPage} />
              <Route path="/admin" component={AdminPage} />

              {/* Public profile — no auth required */}
              <Route path="/u/:username" component={() => <ErrorBoundary><UserProfilePage /></ErrorBoundary>} />

              {/* Core */}
              <Route path="/" component={() => <ErrorBoundary><HomePage /></ErrorBoundary>} />
              <Route path="/dashboard" component={() => <ErrorBoundary><ProtectedRoute component={DashboardPage} /></ErrorBoundary>} />
              <Route path="/analytics" component={() => <ErrorBoundary><ProtectedRoute component={AnalyticsPage} /></ErrorBoundary>} />
              <Route path="/leaderboard" component={() => <ErrorBoundary><ProtectedRoute component={LeaderboardPage} /></ErrorBoundary>} />
              <Route path="/achievements" component={() => <ErrorBoundary><ProtectedRoute component={AchievementsPage} /></ErrorBoundary>} />
              <Route path="/missions" component={() => <ErrorBoundary><ProtectedRoute component={MissionsPage} /></ErrorBoundary>} />

              {/* Social ecosystem */}
              <Route path="/social" component={() => <ErrorBoundary><ProtectedRoute component={SocialPage} /></ErrorBoundary>} />
              <Route path="/notifications" component={() => <ErrorBoundary><ProtectedRoute component={NotificationsPage} /></ErrorBoundary>} />
              <Route path="/groups" component={() => <ErrorBoundary><ProtectedRoute component={GroupsPage} /></ErrorBoundary>} />
              <Route path="/habits" component={() => <ErrorBoundary><ProtectedRoute component={HabitsPage} /></ErrorBoundary>} />
              <Route path="/messages" component={() => <ErrorBoundary><ProtectedRoute component={MessagesPage} /></ErrorBoundary>} />
              <Route path="/shop" component={() => <ErrorBoundary><ProtectedRoute component={ShopPage} /></ErrorBoundary>} />
              <Route path="/goals" component={() => <ErrorBoundary><ProtectedRoute component={GoalsPage} /></ErrorBoundary>} />

              {/* Retention */}
              <Route path="/battle-pass" component={() => <ErrorBoundary><ProtectedRoute component={BattlePassPage} /></ErrorBoundary>} />

              {/* AI */}
              <Route path="/ai-insights" component={() => <ErrorBoundary><ProtectedRoute component={AiInsightsPage} /></ErrorBoundary>} />

              {/* Focus tools */}
              <Route path="/forge" component={() => <ErrorBoundary><ProtectedRoute component={ForgePage} /></ErrorBoundary>} />
              <Route path="/onboarding" component={() => <ErrorBoundary><ProtectedRoute component={OnboardingPage} /></ErrorBoundary>} />
              <Route path="/distractions" component={() => <ErrorBoundary><ProtectedRoute component={DistractionsPage} /></ErrorBoundary>} />
              <Route path="/profiles" component={() => <ErrorBoundary><ProtectedRoute component={ProfilesPage} /></ErrorBoundary>} />
              <Route path="/roadmap" component={() => <ErrorBoundary><RoadmapPage /></ErrorBoundary>} />
              <Route path="/focus-dna" component={() => <ErrorBoundary><ProtectedRoute component={FocusDnaPage} /></ErrorBoundary>} />
              <Route path="/ghosts" component={() => <ErrorBoundary><ProtectedRoute component={GhostsPage} /></ErrorBoundary>} />
              <Route path="/consequences" component={() => <ErrorBoundary><ProtectedRoute component={ConsequencesPage} /></ErrorBoundary>} />
              <Route path="/replay" component={() => <ErrorBoundary><ProtectedRoute component={ReplayPage} /></ErrorBoundary>} />
              <Route path="/breathe" component={() => <ErrorBoundary><BreathePage /></ErrorBoundary>} />
              <Route path="/profile" component={() => <ErrorBoundary><ProtectedRoute component={ProfilePage} /></ErrorBoundary>} />
              <Route path="/break-free" component={() => <ErrorBoundary><BreakFreePage /></ErrorBoundary>} />

              {/* Legal */}
              <Route path="/privacy" component={() => <ErrorBoundary><PrivacyPage /></ErrorBoundary>} />
              <Route path="/terms" component={() => <ErrorBoundary><TermsPage /></ErrorBoundary>} />
              <Route path="/cookie-policy" component={() => <ErrorBoundary><CookiePolicyPage /></ErrorBoundary>} />
              <Route path="/acceptable-use" component={() => <ErrorBoundary><AcceptableUsePage /></ErrorBoundary>} />
              <Route path="/ai-policy" component={() => <ErrorBoundary><AiPolicyPage /></ErrorBoundary>} />
              <Route path="/data-deletion" component={() => <ErrorBoundary><DataDeletionPage /></ErrorBoundary>} />
              <Route path="/pricing" component={() => <ErrorBoundary><PricingPage /></ErrorBoundary>} />

              <Route component={NotFound} />
            </Switch>
          </Suspense>
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
            <SiteAnalyticsTracker />
            <AppWithPalette />
          </WouterRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
