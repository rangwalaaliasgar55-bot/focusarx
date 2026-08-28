import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import PageBackground from "@/components/PageBackground";
import "@/components/page-background.css";
const LandingPage = lazy(() => import("@/pages/landing"));
const FocusHomePage = lazy(() => import("@/pages/focus"));
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";

import { AuthProvider, useAuth, getToken } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import { SiteAnalyticsTracker } from "@/components/SiteAnalyticsTracker";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AppShell from "@/components/AppShell";
import { ViewSkeleton } from "@/components/ui/skeleton";
const CommandPalette = lazy(() => import("@/components/CommandPalette"));
const NotFound = lazy(() => import("@/pages/not-found"));
const LoginPage = lazy(() => import("@/pages/login"));
const SignupPage = lazy(() => import("@/pages/signup"));
const MobileWelcomePage = lazy(() => import("@/pages/mobile-welcome"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const AuthCallbackPage = lazy(() => import("@/pages/auth-callback"));
const AdminPage = lazy(() => import("@/pages/admin"));
import DailyRewardBanner from "@/components/DailyRewardBanner";
import { RewardToastProvider } from "@/components/ui/RewardToast";
import { LiveActivityTicker } from "@/components/LiveActivityTicker";
import FloatingTimer from "@/components/FloatingTimer";
import LiveAnnouncer from "@/components/LiveAnnouncer";
import { FloatingParticles } from "@/components/FloatingParticles";
import { CookieConsent } from "@/components/CookieConsent";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import SeasonalBanner from "@/components/SeasonalBanner";
import { DeploymentUpdateBanner } from "@/components/DeploymentUpdateBanner";
import { useDeploymentSkewDetector } from "@/lib/deploymentSkew";

const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const RoadmapPage = lazy(() => import("@/pages/roadmap"));
const LeaderboardPage = lazy(() => import("@/pages/leaderboard"));
const AchievementsPage = lazy(() => import("@/pages/achievements"));
const AnalyticsPage = lazy(() => import("@/pages/analytics"));
const ForgePage = lazy(() => import("@/pages/forge"));
const FocusDnaPage = lazy(() => import("@/pages/focus-dna"));
const ConsequencesPage = lazy(() => import("@/pages/consequences"));
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
const StudyRoomsPage = lazy(() => import("@/pages/study-rooms"));
const ReferralPage = lazy(() => import("@/pages/referral"));
const PetsPage = lazy(() => import("@/pages/pets"));
const CityPage = lazy(() => import("@/pages/city"));
const MarketplacePage = lazy(() => import("@/pages/marketplace"));
const DreamsPage = lazy(() => import("@/pages/dreams"));
const LootBoxesPage = lazy(() => import("@/pages/lootboxes"));
const WalletPage = lazy(() => import("@/pages/wallet"));
const QuestsPage = lazy(() => import("@/pages/quests"));
const FocusGuidePage = lazy(() => import("@/pages/focus-guide"));
const DeepStudyGuidePage = lazy(() => import("@/pages/deep-study-guide"));
const TwoHourStudyMethodPage = lazy(() => import("@/pages/two-hour-study-method"));
const PremiumPage = lazy(() => import("@/pages/premium"));
const FocusTimerPage = lazy(() => import("@/pages/focus-timer"));
const AboutPage = lazy(() => import("@/pages/about"));
const ContactPage = lazy(() => import("@/pages/contact"));
const SupportPage = lazy(() => import("@/pages/support"));
const PomodoroGuidePage = lazy(() => import("@/pages/pomodoro-guide"));
const StudyTechniquesPage = lazy(() => import("@/pages/study-techniques"));
const VirtualStudyRoomPage = lazy(() => import("@/pages/virtual-study-room"));
const ConstellationsPage = lazy(() => import("@/pages/constellations"));
const ScienceOfDeepWorkPage = lazy(() => import("@/pages/science-of-deep-work"));
const FeynmanTechniquePage = lazy(() => import("@/pages/feynman-technique"));
const StudyMethodQuizPage = lazy(() => import("@/pages/study-method-quiz"));
const ForgeRoomPage = lazy(() => import("@/pages/forge-room"));
const StudyMethodCalculatorPage = lazy(() => import("@/pages/study-calculator"));
const GuidesPage = lazy(() => import("@/pages/guides"));
const ExamHubPage = lazy(() => import("@/pages/exam").then((m) => ({ default: m.ExamHubPage })));
const ExamGuidePage = lazy(() => import("@/pages/exam").then((m) => ({ default: m.ExamGuidePage })));
const AdhdFocusPage = lazy(() => import("@/pages/adhd-focus"));
const StopProcrastinatingPage = lazy(() => import("@/pages/stop-procrastinating"));
const StudyWithMePage = lazy(() => import("@/pages/study-with-me"));
const FocusMusicPage = lazy(() => import("@/pages/focus-music"));
const SearchPage = lazy(() => import("@/pages/search"));
const FlashcardsPage = lazy(() => import("@/pages/flashcards"));
const TasksPage = lazy(() => import("@/pages/tasks"));
const SessionReplayPage = lazy(() => import("@/pages/session-replay"));
const ComparisonPage = lazy(() => import("@/pages/comparison"));
const DeveloperPage = lazy(() => import("@/pages/developer"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => window.dispatchEvent(new CustomEvent("focusarx:api-error", { detail: { message: error instanceof Error ? error.message : "Unable to load data." } })),
  }),
  mutationCache: new MutationCache({
    onError: (error) => window.dispatchEvent(new CustomEvent("focusarx:api-error", { detail: { message: error instanceof Error ? error.message : "Unable to save your changes." } })),
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const err = error as { status?: number; message?: string } | null;
        if (err?.status === 401 || err?.status === 403) return false;
        if (err?.message?.includes("401") || err?.message?.includes("403")) return false;
        return failureCount < 2;
      },
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      // Live data arrives over Socket.IO, and stale queries refetch on mount,
      // so re-hammering every endpoint on each window focus was pure waste.
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

function isMobileDevice() {
  return window.innerWidth < 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function hasDoneMobileWelcome() {
  return localStorage.getItem("focusarx-mobile-welcome-done") === "1";
}

function MobileWelcomeGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated") return;
    if (hasDoneMobileWelcome()) return;
    // Never redirect web crawlers — Googlebot mobile UA contains "Android"/"Mobile"
    if (/bot|crawl|spider|Googlebot|bingbot|Slurp|DuckDuck/i.test(navigator.userAgent)) return;
    if (isMobileDevice()) {
      const path = window.location.pathname;
      // Auth / admin pages handle their own flow
      const authPaths = ["/welcome", "/login", "/signup", "/forgot-password", "/reset-password", "/auth", "/admin"];
      // Public marketing & SEO pages must never redirect — crawlers and direct-link visitors should see content
      const publicPaths = [
        "/focus-guide", "/pomodoro-guide", "/study-techniques", "/virtual-study-room",
        "/deep-study-guide", "/two-hour-study-method",
        "/study-rooms", "/breathe", "/break-free", "/roadmap", "/leaderboard",
        "/about", "/contact", "/support", "/pricing", "/comparison/",
        "/privacy", "/terms", "/cookie-policy", "/acceptable-use", "/ai-policy",
        "/data-deletion", "/u/",
      ];
      const skip = [...authPaths, ...publicPaths];
      if (!skip.some(p => path.startsWith(p))) setLocation("/welcome");
    }
  }, [status, setLocation]);
  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="page-container min-h-[60vh] py-10">
      <ViewSkeleton rows={6} />
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { status } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (status === "unauthenticated") setLocation("/login");
  }, [status, setLocation]);
  if (status === "loading") return <PageLoader />;
  if (status === "unauthenticated") return null;
  return <Component />;
}

function RootPage() {
  const { status } = useAuth();
  if (status === "loading") return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--palette-1a1d27)] border-t-[var(--brand-600)]" />
    </div>
  );
  if (status === "unauthenticated") return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[var(--background)]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--palette-1a1d27)] border-t-[var(--brand-600)]" /></div>}>
      <LandingPage />
    </Suspense>
  );
  return (
    <Suspense fallback={<PageLoader />}>
      <FocusHomePage />
    </Suspense>
  );
}

function GlobalBackground({ isFocusing }: { isFocusing: boolean }) {
  const { status } = useAuth();
  const [location] = useLocation();
  // The landing page renders its own full-bleed 3D hero (Hero3D); skip the
  // global WebGL backdrop there so we never run two GPU contexts at once.
  const skip = location === "/" && status === "unauthenticated";
  if (skip) return null;
  return <PageBackground isFocusing={isFocusing} />;
}

function SocketInitializer() {
  const { data: session, status } = useAuth();
  useEffect(() => {
    if (status !== "authenticated") return;
    // Cookie-first: connectSocket exchanges the session cookie for a 60s
    // socket ticket; the localStorage bearer (legacy) is only a fallback.
    void connectSocket(getToken() ?? undefined);
    return () => { disconnectSocket(); };
  }, [status, session?.user?.id]);
  return null;
}

function RoutedContent() {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        style={{ height: "100%" }}
      >
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

              {/* Core — Landing page for guests, Home for authenticated */}
              <Route path="/" component={() => <ErrorBoundary><RootPage /></ErrorBoundary>} />
              <Route path="/dashboard" component={() => <ErrorBoundary><ProtectedRoute component={DashboardPage} /></ErrorBoundary>} />
              <Route path="/analytics" component={() => <ErrorBoundary><ProtectedRoute component={AnalyticsPage} /></ErrorBoundary>} />
              <Route path="/session-replay" component={() => <ErrorBoundary><ProtectedRoute component={SessionReplayPage} /></ErrorBoundary>} />
              <Route path="/leaderboard" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><LeaderboardPage /></Suspense></ErrorBoundary>} />
              <Route path="/achievements" component={() => <ErrorBoundary><ProtectedRoute component={AchievementsPage} /></ErrorBoundary>} />
              <Route path="/missions" component={() => <ErrorBoundary><ProtectedRoute component={MissionsPage} /></ErrorBoundary>} />

              {/* Social ecosystem */}
              <Route path="/social" component={() => <ErrorBoundary><ProtectedRoute component={SocialPage} /></ErrorBoundary>} />
              <Route path="/notifications" component={() => <ErrorBoundary><ProtectedRoute component={NotificationsPage} /></ErrorBoundary>} />
              <Route path="/groups" component={() => <ErrorBoundary><ProtectedRoute component={GroupsPage} /></ErrorBoundary>} />
              <Route path="/tasks" component={() => <ErrorBoundary><ProtectedRoute component={TasksPage} /></ErrorBoundary>} />
              <Route path="/habits" component={() => <ErrorBoundary><ProtectedRoute component={HabitsPage} /></ErrorBoundary>} />
              <Route path="/flashcards" component={() => <ErrorBoundary><ProtectedRoute component={FlashcardsPage} /></ErrorBoundary>} />
              <Route path="/messages" component={() => <ErrorBoundary><ProtectedRoute component={MessagesPage} /></ErrorBoundary>} />
              <Route path="/shop" component={() => <ErrorBoundary><ProtectedRoute component={ShopPage} /></ErrorBoundary>} />
              <Route path="/goals" component={() => <ErrorBoundary><ProtectedRoute component={GoalsPage} /></ErrorBoundary>} />
              <Route path="/study-rooms" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><StudyRoomsPage /></Suspense></ErrorBoundary>} />
              <Route path="/focus-guide" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><FocusGuidePage /></Suspense></ErrorBoundary>} />
              <Route path="/deep-study-guide" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><DeepStudyGuidePage /></Suspense></ErrorBoundary>} />
              <Route path="/two-hour-study-method" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><TwoHourStudyMethodPage /></Suspense></ErrorBoundary>} />
              <Route path="/pomodoro-guide" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><PomodoroGuidePage /></Suspense></ErrorBoundary>} />
              <Route path="/study-techniques" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><StudyTechniquesPage /></Suspense></ErrorBoundary>} />
              <Route path="/virtual-study-room" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><VirtualStudyRoomPage /></Suspense></ErrorBoundary>} />
              <Route path="/science-of-deep-work" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><ScienceOfDeepWorkPage /></Suspense></ErrorBoundary>} />
              <Route path="/feynman-technique" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><FeynmanTechniquePage /></Suspense></ErrorBoundary>} />
              <Route path="/study-method-quiz" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><StudyMethodQuizPage /></Suspense></ErrorBoundary>} />
              <Route path="/forge-room" component={() => <ErrorBoundary><ProtectedRoute component={ForgeRoomPage} /></ErrorBoundary>} />
              <Route path="/study-calculator" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><StudyMethodCalculatorPage /></Suspense></ErrorBoundary>} />
              <Route path="/guides" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><GuidesPage /></Suspense></ErrorBoundary>} />
              <Route path="/exam" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><ExamHubPage /></Suspense></ErrorBoundary>} />
              <Route path="/exam/:slug" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><ExamGuidePage /></Suspense></ErrorBoundary>} />
              <Route path="/adhd-focus-tips" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><AdhdFocusPage /></Suspense></ErrorBoundary>} />
              <Route path="/stop-procrastinating" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><StopProcrastinatingPage /></Suspense></ErrorBoundary>} />
              <Route path="/study-with-me" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><StudyWithMePage /></Suspense></ErrorBoundary>} />
              <Route path="/focus-music" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><FocusMusicPage /></Suspense></ErrorBoundary>} />
              <Route path="/search" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><SearchPage /></Suspense></ErrorBoundary>} />
              <Route path="/referral" component={() => <ErrorBoundary><ProtectedRoute component={ReferralPage} /></ErrorBoundary>} />
              <Route path="/developer" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><DeveloperPage /></Suspense></ErrorBoundary>} />

              {/* New V12 pages */}
              <Route path="/pets" component={() => <ErrorBoundary><ProtectedRoute component={PetsPage} /></ErrorBoundary>} />
              <Route path="/city" component={() => <ErrorBoundary><ProtectedRoute component={CityPage} /></ErrorBoundary>} />
              <Route path="/marketplace" component={() => <ErrorBoundary><ProtectedRoute component={MarketplacePage} /></ErrorBoundary>} />
              <Route path="/dreams" component={() => <ErrorBoundary><ProtectedRoute component={DreamsPage} /></ErrorBoundary>} />
              <Route path="/lootboxes" component={() => <ErrorBoundary><ProtectedRoute component={LootBoxesPage} /></ErrorBoundary>} />
              <Route path="/wallet" component={() => <ErrorBoundary><ProtectedRoute component={WalletPage} /></ErrorBoundary>} />
              <Route path="/dna" component={() => <ErrorBoundary><ProtectedRoute component={FocusDnaPage} /></ErrorBoundary>} />
              <Route path="/quests" component={() => <ErrorBoundary><ProtectedRoute component={QuestsPage} /></ErrorBoundary>} />

              {/* Retention */}
              <Route path="/battle-pass" component={() => <ErrorBoundary><ProtectedRoute component={BattlePassPage} /></ErrorBoundary>} />

              {/* AI */}
              <Route path="/ai-insights" component={() => <ErrorBoundary><ProtectedRoute component={AiInsightsPage} /></ErrorBoundary>} />

              {/* Focus tools */}
              <Route path="/forge" component={() => <ErrorBoundary><ProtectedRoute component={ForgePage} /></ErrorBoundary>} />
              <Route path="/onboarding" component={() => <ErrorBoundary><ProtectedRoute component={OnboardingPage} /></ErrorBoundary>} />
              <Route path="/roadmap" component={() => <ErrorBoundary><RoadmapPage /></ErrorBoundary>} />
              <Route path="/focus-dna" component={() => <ErrorBoundary><ProtectedRoute component={FocusDnaPage} /></ErrorBoundary>} />
              <Route path="/constellations" component={() => <ErrorBoundary><ProtectedRoute component={ConstellationsPage} /></ErrorBoundary>} />
              <Route path="/consequences" component={() => <ErrorBoundary><ProtectedRoute component={ConsequencesPage} /></ErrorBoundary>} />
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
              <Route path="/comparison/focusarx-vs-forest" component={() => <ErrorBoundary><ComparisonPage /></ErrorBoundary>} />
              <Route path="/comparison/focusarx-vs-focus-todo" component={() => <ErrorBoundary><ComparisonPage /></ErrorBoundary>} />
              <Route path="/premium" component={() => <ErrorBoundary><ProtectedRoute component={PremiumPage} /></ErrorBoundary>} />
              <Route path="/about" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><AboutPage /></Suspense></ErrorBoundary>} />
              <Route path="/contact" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><ContactPage /></Suspense></ErrorBoundary>} />
              <Route path="/support" component={() => <ErrorBoundary><Suspense fallback={<PageLoader />}><SupportPage /></Suspense></ErrorBoundary>} />

              <Route component={NotFound} />
            </Switch>
          </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function AppWithPalette() {
  const { status } = useAuth();
  const [, setLocation] = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Quick page switching (audit L2): 1-Home, 2-Tasks, 3-Analytics,
  // 4-Leaderboard, 5-Achievements. Ignored while typing or with modifiers.
  useEffect(() => {
    if (status !== "authenticated") return;
    const pageKeys: Record<string, string> = {
      "1": "/",
      "2": "/tasks",
      "3": "/analytics",
      "4": "/leaderboard",
      "5": "/achievements",
    };
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = pageKeys[e.key];
      if (!target || paletteOpen) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (el?.isContentEditable) return;
      setLocation(target);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [status, paletteOpen, setLocation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    const openPalette = () => setPaletteOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener("focusarx:open-command", openPalette);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("focusarx:open-command", openPalette);
    };
  }, []);

  return (
    <>
      {status === "authenticated" && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </Suspense>
      )}
      <AnnouncementBanner />
      <DeploymentUpdateBanner />
      {status === "authenticated" && <div className="px-3 pt-2 sm:px-5"><SeasonalBanner /></div>}
      <DailyRewardBanner />
      <LiveActivityTicker />
      <FloatingTimer />
      <LiveAnnouncer />
      <CookieConsent />
      <MaintenanceGate>
        <MobileWelcomeGate>
          <AppShell>
            <RoutedContent />
          </AppShell>
        </MobileWelcomeGate>
      </MaintenanceGate>
    </>
  );
}

function App() {
  const [isFocusing, setIsFocusing] = useState(false);

  // Deployment skew detection — polls for new deployments and checks
  // response headers to detect version mismatches.
  useDeploymentSkewDetector();

  useEffect(() => {
    const start = () => setIsFocusing(true);
    const stop = () => setIsFocusing(false);
    window.addEventListener("fx:focus-start", start);
    window.addEventListener("fx:focus-stop", stop);
    return () => {
      window.removeEventListener("fx:focus-start", start);
      window.removeEventListener("fx:focus-stop", stop);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
        <RewardToastProvider>
        <ToastProvider>
          <FloatingParticles count={14} />
          <SocketInitializer />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <GlobalBackground isFocusing={isFocusing} />
            <SiteAnalyticsTracker />
            <AppWithPalette />
          </WouterRouter>
        </ToastProvider>
        </RewardToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MotionConfig>
  );
}

export default App;
