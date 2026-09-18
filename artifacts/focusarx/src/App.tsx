import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import PageBackground from "@/components/PageBackground";
import "@/components/page-background.css";
const LandingPage = lazy(() => import("@/pages/landing"));
const FocusHomePage = lazy(() => import("@/pages/focus"));
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

import { AuthProvider, useAuth, getToken } from "@/lib/auth";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { PromptProvider } from "@/components/ui/PromptDialog";
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
import { InAppBrowserPill } from "@/components/InAppBrowserPill";
import { FloatingParticles } from "@/components/FloatingParticles";
import { CookieConsent } from "@/components/CookieConsent";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import SeasonalBanner from "@/components/SeasonalBanner";
import { DeploymentUpdateBanner } from "@/components/DeploymentUpdateBanner";
import { useDeploymentSkewDetector } from "@/lib/deploymentSkew";

/**
 * Instagram funnel entry: /go/ig → /focus armed with a 25-min slice and
 * src attribution. The Core is armed, not auto-started — one "Begin" tap
 * keeps autoplay policies and user intent intact.
 */
function IgEntry() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/focus?duration=25&src=ig");
  }, [setLocation]);
  return <PageLoader />;
}

const ChangelogPage = lazy(() => import("@/pages/changelog"));
const BlogPage = lazy(() => import("@/pages/blog"));
const BlogPostPage = lazy(() => import("@/pages/blog-post"));
const ExamFunnelPage = lazy(() => import("@/pages/exam-funnel"));

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

const ComparisonPage = lazy(() => import("@/pages/comparison"));
const DeveloperPage = lazy(() => import("@/pages/developer"));

// ── Intent pages (tools, cluster spokes, trust) ────────────────────
// Each is a thin wrapper over <SeoLandingPage>, driven by the content in
// src/content/seo-pages.mjs. That file is also what the build-time
// prerenderer reads, so static HTML and rendered copy stay identical.
const PomodoroTimerPage = lazy(() => import("@/pages/pomodoro-timer"));
const MinuteTimerPage = lazy(() => import("@/pages/minute-timer"));
const StudyTimerPage = lazy(() => import("@/pages/study-timer"));
const DeepWorkGuidePage = lazy(() => import("@/pages/deep-work-guide"));
const BodyDoublingPage = lazy(() => import("@/pages/body-doubling"));
const HowToFocusWhileStudyingPage = lazy(() => import("@/pages/how-to-focus-while-studying"));
const AdhdFocusToolsPage = lazy(() => import("@/pages/adhd-focus-tools"));
const StopScrollingPage = lazy(() => import("@/pages/stop-scrolling"));
// Audience pages: the same timer described in one reader's own day (WS8d).
const StudyTimerForMedicalStudentsPage = lazy(() => import("@/pages/study-timer-for-medical-students"));
const FocusTimerForProgrammersPage = lazy(() => import("@/pages/focus-timer-for-programmers"));
const EvidencePage = lazy(() => import("@/pages/evidence"));
const CameraDataPage = lazy(() => import("@/pages/camera-data"));
const SafetyPage = lazy(() => import("@/pages/safety"));
const AccessibilityPage = lazy(() => import("@/pages/accessibility"));
const PressPage = lazy(() => import("@/pages/press"));

// The QueryClient lives in @/lib/queryClient so the auth provider can clear it
// on sign-out (cached data from the previous account must not survive).

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
      // Deep-link entry points must never bounce to /welcome: the timer is
      // the landing for Instagram traffic (guests included).
      if (path === "/focus" || path.startsWith("/go/")) return;
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
    if (status !== "unauthenticated") return;
    // Preserve where the user was actually going. Without this, opening a deep
    // link while signed out bounces you to the dashboard after login and the
    // original destination is lost — which is exactly the flow that matters
    // most (shared links, password-resume, push notification targets).
    const target = window.location.pathname + window.location.search;
    const safe = target.startsWith("/") ? target : "/";
    // Never bounce the user back to the login page itself.
    const redirect = safe === "/login" ? "/" : safe;
    setLocation(`/login?redirect=${encodeURIComponent(redirect)}`);
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
              <Route path="/u/:username"><ErrorBoundary><UserProfilePage /></ErrorBoundary></Route>

              {/* Core — Landing page for guests, Home for authenticated */}
              <Route path="/"><ErrorBoundary><RootPage /></ErrorBoundary></Route>
              {/* Standalone focus app: public, deep-linkable, guest-first.
                  This is the Instagram funnel landing (see IgEntry). */}
              <Route path="/focus"><ErrorBoundary><Suspense fallback={<PageLoader />}><FocusHomePage /></Suspense></ErrorBoundary></Route>
              <Route path="/go/ig" component={IgEntry} />
              <Route path="/changelog"><ErrorBoundary><Suspense fallback={<PageLoader />}><ChangelogPage /></Suspense></ErrorBoundary></Route>
              <Route path="/blog"><ErrorBoundary><Suspense fallback={<PageLoader />}><BlogPage /></Suspense></ErrorBoundary></Route>
              <Route path="/blog/:slug"><ErrorBoundary><Suspense fallback={<PageLoader />}><BlogPostPage /></Suspense></ErrorBoundary></Route>
              <Route path="/pomodoro-timer-for/:exam"><ErrorBoundary><Suspense fallback={<PageLoader />}><ExamFunnelPage /></Suspense></ErrorBoundary></Route>
              <Route path="/dashboard"><ErrorBoundary><ProtectedRoute component={DashboardPage} /></ErrorBoundary></Route>
              <Route path="/analytics"><ErrorBoundary><ProtectedRoute component={AnalyticsPage} /></ErrorBoundary></Route>

              <Route path="/leaderboard"><ErrorBoundary><Suspense fallback={<PageLoader />}><LeaderboardPage /></Suspense></ErrorBoundary></Route>
              <Route path="/achievements"><ErrorBoundary><ProtectedRoute component={AchievementsPage} /></ErrorBoundary></Route>
              <Route path="/missions"><ErrorBoundary><ProtectedRoute component={MissionsPage} /></ErrorBoundary></Route>

              {/* Social ecosystem */}
              <Route path="/social"><ErrorBoundary><ProtectedRoute component={SocialPage} /></ErrorBoundary></Route>
              <Route path="/notifications"><ErrorBoundary><ProtectedRoute component={NotificationsPage} /></ErrorBoundary></Route>
              <Route path="/groups"><ErrorBoundary><ProtectedRoute component={GroupsPage} /></ErrorBoundary></Route>
              <Route path="/tasks"><ErrorBoundary><ProtectedRoute component={TasksPage} /></ErrorBoundary></Route>
              <Route path="/habits"><ErrorBoundary><ProtectedRoute component={HabitsPage} /></ErrorBoundary></Route>
              <Route path="/flashcards"><ErrorBoundary><ProtectedRoute component={FlashcardsPage} /></ErrorBoundary></Route>
              <Route path="/messages"><ErrorBoundary><ProtectedRoute component={MessagesPage} /></ErrorBoundary></Route>
              <Route path="/shop"><ErrorBoundary><ProtectedRoute component={ShopPage} /></ErrorBoundary></Route>
              <Route path="/goals"><ErrorBoundary><ProtectedRoute component={GoalsPage} /></ErrorBoundary></Route>
              <Route path="/study-rooms"><ErrorBoundary><Suspense fallback={<PageLoader />}><StudyRoomsPage /></Suspense></ErrorBoundary></Route>
              <Route path="/focus-guide"><ErrorBoundary><Suspense fallback={<PageLoader />}><FocusGuidePage /></Suspense></ErrorBoundary></Route>
              <Route path="/deep-study-guide"><ErrorBoundary><Suspense fallback={<PageLoader />}><DeepStudyGuidePage /></Suspense></ErrorBoundary></Route>
              <Route path="/two-hour-study-method"><ErrorBoundary><Suspense fallback={<PageLoader />}><TwoHourStudyMethodPage /></Suspense></ErrorBoundary></Route>
              <Route path="/pomodoro-guide"><ErrorBoundary><Suspense fallback={<PageLoader />}><PomodoroGuidePage /></Suspense></ErrorBoundary></Route>
              <Route path="/study-techniques"><ErrorBoundary><Suspense fallback={<PageLoader />}><StudyTechniquesPage /></Suspense></ErrorBoundary></Route>
              <Route path="/virtual-study-room"><ErrorBoundary><Suspense fallback={<PageLoader />}><VirtualStudyRoomPage /></Suspense></ErrorBoundary></Route>
              <Route path="/science-of-deep-work"><ErrorBoundary><Suspense fallback={<PageLoader />}><ScienceOfDeepWorkPage /></Suspense></ErrorBoundary></Route>
              <Route path="/feynman-technique"><ErrorBoundary><Suspense fallback={<PageLoader />}><FeynmanTechniquePage /></Suspense></ErrorBoundary></Route>
              <Route path="/study-method-quiz"><ErrorBoundary><Suspense fallback={<PageLoader />}><StudyMethodQuizPage /></Suspense></ErrorBoundary></Route>
              <Route path="/forge-room"><ErrorBoundary><ProtectedRoute component={ForgeRoomPage} /></ErrorBoundary></Route>
              <Route path="/study-calculator"><ErrorBoundary><Suspense fallback={<PageLoader />}><StudyMethodCalculatorPage /></Suspense></ErrorBoundary></Route>
              <Route path="/guides"><ErrorBoundary><Suspense fallback={<PageLoader />}><GuidesPage /></Suspense></ErrorBoundary></Route>
              <Route path="/exam"><ErrorBoundary><Suspense fallback={<PageLoader />}><ExamHubPage /></Suspense></ErrorBoundary></Route>
              <Route path="/exam/:slug"><ErrorBoundary><Suspense fallback={<PageLoader />}><ExamGuidePage /></Suspense></ErrorBoundary></Route>
              <Route path="/adhd-focus-tips"><ErrorBoundary><Suspense fallback={<PageLoader />}><AdhdFocusPage /></Suspense></ErrorBoundary></Route>
              <Route path="/stop-procrastinating"><ErrorBoundary><Suspense fallback={<PageLoader />}><StopProcrastinatingPage /></Suspense></ErrorBoundary></Route>
              <Route path="/study-with-me"><ErrorBoundary><Suspense fallback={<PageLoader />}><StudyWithMePage /></Suspense></ErrorBoundary></Route>
              <Route path="/focus-music"><ErrorBoundary><Suspense fallback={<PageLoader />}><FocusMusicPage /></Suspense></ErrorBoundary></Route>

              {/* ── Intent pages: tools, cluster spokes, trust ──────
                  Public and crawlable — none of these are behind
                  <ProtectedRoute>, so all of them appear in the sitemap
                  and in scripts/prerender-data.mjs. seoContract.test.ts
                  fails the build if those three lists drift apart. */}
              <Route path="/focus-timer"><ErrorBoundary><Suspense fallback={<PageLoader />}><FocusTimerPage /></Suspense></ErrorBoundary></Route>
              <Route path="/pomodoro-timer"><ErrorBoundary><Suspense fallback={<PageLoader />}><PomodoroTimerPage /></Suspense></ErrorBoundary></Route>
              <Route path="/study-timer"><ErrorBoundary><Suspense fallback={<PageLoader />}><StudyTimerPage /></Suspense></ErrorBoundary></Route>
              <Route path="/5-minute-timer"><ErrorBoundary><Suspense fallback={<PageLoader />}><MinuteTimerPage minutes={5} /></Suspense></ErrorBoundary></Route>
              <Route path="/10-minute-timer"><ErrorBoundary><Suspense fallback={<PageLoader />}><MinuteTimerPage minutes={10} /></Suspense></ErrorBoundary></Route>
              <Route path="/15-minute-timer"><ErrorBoundary><Suspense fallback={<PageLoader />}><MinuteTimerPage minutes={15} /></Suspense></ErrorBoundary></Route>
              <Route path="/30-minute-timer"><ErrorBoundary><Suspense fallback={<PageLoader />}><MinuteTimerPage minutes={30} /></Suspense></ErrorBoundary></Route>
              <Route path="/45-minute-timer"><ErrorBoundary><Suspense fallback={<PageLoader />}><MinuteTimerPage minutes={45} /></Suspense></ErrorBoundary></Route>
              <Route path="/deep-work-guide"><ErrorBoundary><Suspense fallback={<PageLoader />}><DeepWorkGuidePage /></Suspense></ErrorBoundary></Route>
              <Route path="/body-doubling"><ErrorBoundary><Suspense fallback={<PageLoader />}><BodyDoublingPage /></Suspense></ErrorBoundary></Route>
              <Route path="/how-to-focus-while-studying"><ErrorBoundary><Suspense fallback={<PageLoader />}><HowToFocusWhileStudyingPage /></Suspense></ErrorBoundary></Route>
              <Route path="/adhd-focus-tools"><ErrorBoundary><Suspense fallback={<PageLoader />}><AdhdFocusToolsPage /></Suspense></ErrorBoundary></Route>
              <Route path="/stop-scrolling"><ErrorBoundary><Suspense fallback={<PageLoader />}><StopScrollingPage /></Suspense></ErrorBoundary></Route>
              <Route path="/study-timer-for-medical-students"><ErrorBoundary><Suspense fallback={<PageLoader />}><StudyTimerForMedicalStudentsPage /></Suspense></ErrorBoundary></Route>
              <Route path="/focus-timer-for-programmers"><ErrorBoundary><Suspense fallback={<PageLoader />}><FocusTimerForProgrammersPage /></Suspense></ErrorBoundary></Route>
              <Route path="/evidence"><ErrorBoundary><Suspense fallback={<PageLoader />}><EvidencePage /></Suspense></ErrorBoundary></Route>
              <Route path="/camera-data"><ErrorBoundary><Suspense fallback={<PageLoader />}><CameraDataPage /></Suspense></ErrorBoundary></Route>
              <Route path="/safety"><ErrorBoundary><Suspense fallback={<PageLoader />}><SafetyPage /></Suspense></ErrorBoundary></Route>
              <Route path="/accessibility"><ErrorBoundary><Suspense fallback={<PageLoader />}><AccessibilityPage /></Suspense></ErrorBoundary></Route>
              <Route path="/press"><ErrorBoundary><Suspense fallback={<PageLoader />}><PressPage /></Suspense></ErrorBoundary></Route>
              <Route path="/comparison/:slug"><ErrorBoundary><Suspense fallback={<PageLoader />}><ComparisonPage /></Suspense></ErrorBoundary></Route>

              <Route path="/search"><ErrorBoundary><Suspense fallback={<PageLoader />}><SearchPage /></Suspense></ErrorBoundary></Route>
              <Route path="/referral"><ErrorBoundary><ProtectedRoute component={ReferralPage} /></ErrorBoundary></Route>
              <Route path="/developer"><ErrorBoundary><Suspense fallback={<PageLoader />}><DeveloperPage /></Suspense></ErrorBoundary></Route>

              {/* New V12 pages */}
              <Route path="/pets"><ErrorBoundary><ProtectedRoute component={PetsPage} /></ErrorBoundary></Route>
              <Route path="/city"><ErrorBoundary><ProtectedRoute component={CityPage} /></ErrorBoundary></Route>
              <Route path="/marketplace"><ErrorBoundary><ProtectedRoute component={MarketplacePage} /></ErrorBoundary></Route>
              <Route path="/dreams"><ErrorBoundary><ProtectedRoute component={DreamsPage} /></ErrorBoundary></Route>
              <Route path="/lootboxes"><ErrorBoundary><ProtectedRoute component={LootBoxesPage} /></ErrorBoundary></Route>
              <Route path="/wallet"><ErrorBoundary><ProtectedRoute component={WalletPage} /></ErrorBoundary></Route>
              <Route path="/dna"><Redirect to="/focus-dna" /></Route>
              <Route path="/quests"><ErrorBoundary><ProtectedRoute component={QuestsPage} /></ErrorBoundary></Route>

              {/* Retention */}
              <Route path="/battle-pass"><ErrorBoundary><ProtectedRoute component={BattlePassPage} /></ErrorBoundary></Route>

              {/* AI */}
              <Route path="/ai-insights"><ErrorBoundary><ProtectedRoute component={AiInsightsPage} /></ErrorBoundary></Route>

              {/* Focus tools */}
              <Route path="/forge"><ErrorBoundary><ProtectedRoute component={ForgePage} /></ErrorBoundary></Route>
              <Route path="/onboarding"><ErrorBoundary><ProtectedRoute component={OnboardingPage} /></ErrorBoundary></Route>
              <Route path="/roadmap"><ErrorBoundary><RoadmapPage /></ErrorBoundary></Route>
              <Route path="/focus-dna"><ErrorBoundary><ProtectedRoute component={FocusDnaPage} /></ErrorBoundary></Route>
              <Route path="/constellations"><ErrorBoundary><ProtectedRoute component={ConstellationsPage} /></ErrorBoundary></Route>
              <Route path="/consequences"><ErrorBoundary><ProtectedRoute component={ConsequencesPage} /></ErrorBoundary></Route>
              <Route path="/breathe"><ErrorBoundary><BreathePage /></ErrorBoundary></Route>
              <Route path="/profile"><ErrorBoundary><ProtectedRoute component={ProfilePage} /></ErrorBoundary></Route>
              <Route path="/break-free"><ErrorBoundary><BreakFreePage /></ErrorBoundary></Route>

              {/* Legal */}
              <Route path="/privacy"><ErrorBoundary><PrivacyPage /></ErrorBoundary></Route>
              <Route path="/terms"><ErrorBoundary><TermsPage /></ErrorBoundary></Route>
              <Route path="/cookie-policy"><ErrorBoundary><CookiePolicyPage /></ErrorBoundary></Route>
              <Route path="/acceptable-use"><ErrorBoundary><AcceptableUsePage /></ErrorBoundary></Route>
              <Route path="/ai-policy"><ErrorBoundary><AiPolicyPage /></ErrorBoundary></Route>
              <Route path="/data-deletion"><ErrorBoundary><DataDeletionPage /></ErrorBoundary></Route>
              <Route path="/pricing"><ErrorBoundary><PricingPage /></ErrorBoundary></Route>
              {/* Comparison pages are handled by the /comparison/:slug route
                  above; the slug map lives in src/content/seo-pages.mjs. */}
              <Route path="/premium"><ErrorBoundary><ProtectedRoute component={PremiumPage} /></ErrorBoundary></Route>
              <Route path="/about"><ErrorBoundary><Suspense fallback={<PageLoader />}><AboutPage /></Suspense></ErrorBoundary></Route>
              <Route path="/contact"><ErrorBoundary><Suspense fallback={<PageLoader />}><ContactPage /></Suspense></ErrorBoundary></Route>
              <Route path="/support"><ErrorBoundary><Suspense fallback={<PageLoader />}><SupportPage /></Suspense></ErrorBoundary></Route>

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
      <InAppBrowserPill />
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
        <ConfirmProvider>
        <PromptProvider>
          <FloatingParticles count={14} />
          <SocketInitializer />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <GlobalBackground isFocusing={isFocusing} />
            <SiteAnalyticsTracker />
            <AppWithPalette />
          </WouterRouter>
        </PromptProvider>
        </ConfirmProvider>
        </ToastProvider>
        </RewardToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MotionConfig>
  );
}

export default App;
