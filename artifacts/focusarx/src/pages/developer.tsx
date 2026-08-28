/**
 * /developer — Premium interactive technical documentation page.
 *
 * Provides:
 * - Architecture overview (frontend, backend, database, AI, deployment)
 * - API documentation (generated from structured data)
 * - Feature call-flow diagrams
 * - Database schema explorer (read-only metadata)
 * - Code examples
 *
 * This page is public but requires authentication to see the schema explorer
 * (to prevent information disclosure to unauthenticated visitors).
 */
import { useState, lazy, Suspense } from "react";
import { PageSEO } from "@/components/PageSEO";
import { useAuth } from "@/lib/auth";
import {
  Code2, Database, Server, Globe, Shield, Cpu,
  Layers, GitBranch, Zap, BookOpen, ArrowRight,
  Monitor, Cloud, Brain, Lock,
} from "lucide-react";

const SchemaExplorer = lazy(() =>
  import("@/components/developer/SchemaExplorer").then((m) => ({ default: m.SchemaExplorer }))
);
const ApiDocumentation = lazy(() =>
  import("@/components/developer/ApiDocumentation").then((m) => ({ default: m.ApiDocumentation }))
);

type Tab = "architecture" | "api" | "flows" | "schema" | "examples";

const TABS: { id: Tab; label: string; icon: typeof Code2 }[] = [
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "api", label: "API Docs", icon: BookOpen },
  { id: "flows", label: "Call Flows", icon: GitBranch },
  { id: "schema", label: "Schema Explorer", icon: Database },
  { id: "examples", label: "Examples", icon: Code2 },
];

export default function DeveloperPage() {
  const [tab, setTab] = useState<Tab>("architecture");
  const { status } = useAuth();

  return (
    <div className="page-container max-w-6xl mx-auto py-8 px-4">
      <PageSEO
        title="Developer Documentation — FocusArx"
        description="Technical documentation, API reference, architecture diagrams, and schema explorer for FocusArx developers."
        canonical="/developer"
      />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
            <Code2 className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Developer</h1>
        </div>
        <p className="text-white/60 max-w-2xl">
          Technical documentation for FocusArx — the deep work OS. Explore the architecture,
          browse the API, visualize the database schema, and see how features flow through the system.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-2 border-b border-white/10">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  : "text-white/50 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <Suspense fallback={
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-lg" />
          ))}
        </div>
      }>
        {tab === "architecture" && <ArchitectureSection />}
        {tab === "api" && <ApiDocumentation />}
        {tab === "flows" && <CallFlowsSection />}
        {tab === "schema" && (
          status === "authenticated" ? (
            <SchemaExplorer />
          ) : (
            <div className="p-8 text-center text-white/40 border border-white/10 rounded-lg">
              <Lock className="w-8 h-8 mx-auto mb-3" />
              <p>Sign in to access the database schema explorer.</p>
            </div>
          )
        )}
        {tab === "examples" && <CodeExamplesSection />}
      </Suspense>
    </div>
  );
}

// ─── Architecture Section ─────────────────────────────────────────────────────

function ArchitectureSection() {
  const layers = [
    {
      icon: Monitor,
      title: "Frontend (React 19 + Vite)",
      color: "blue",
      items: [
        "React 19 with TypeScript, wouter routing, TanStack Query",
        "Tailwind CSS 4, Framer Motion, Radix UI primitives",
        "Three.js + React Three Fiber for 3D Focus City",
        "PWA with service worker, offline support",
        "Build-time prerendering for SEO on public pages",
      ],
    },
    {
      icon: Server,
      title: "API Server (Express 5 + Node.js)",
      color: "emerald",
      items: [
        "60+ REST endpoints with Zod validation",
        "JWT auth + httpOnly refresh token rotation",
        "Rate limiting (per-instance + Upstash Redis shared)",
        "Socket.IO for real-time study room presence",
        "Pino structured logging with request IDs",
      ],
    },
    {
      icon: Database,
      title: "Database (PostgreSQL + Neon)",
      color: "purple",
      items: [
        "Drizzle ORM with type-safe queries",
        "40+ tables with proper indexes and foreign keys",
        "Server-authoritative reward logic (no client trust)",
        "Idempotency keys on critical mutations",
        "Versioned migrations with CI validation",
      ],
    },
    {
      icon: Brain,
      title: "AI Providers (Gemini + Groq)",
      color: "amber",
      items: [
        "Gemini 2.5 Flash for study roadmaps and insights",
        "Groq for real-time AI coaching responses",
        "Budget-aware (daily call caps per provider)",
        "Graceful degradation when API keys absent",
        "Keyword moderation fallback without AI",
      ],
    },
    {
      icon: Cloud,
      title: "Infrastructure (Vercel)",
      color: "cyan",
      items: [
        "Static frontend + serverless API functions",
        "Preview deployments per pull request",
        "Deployment skew protection (version headers)",
        "Cron jobs for retention and re-engagement",
        "Immutable hashed assets with long-lived caching",
      ],
    },
    {
      icon: Shield,
      title: "Security",
      color: "red",
      items: [
        "CSP, COOP/COEP, X-Frame-Options: DENY",
        "Bot filtering + UA-based neural shield",
        "SQL injection protection via parameterized queries",
        "AI prompt injection guardrails",
        "Secret scanning in CI pipeline",
      ],
    },
  ];

  const colorMap: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
    emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20",
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/20",
    amber: "from-amber-500/20 to-amber-600/5 border-amber-500/20",
    cyan: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/20",
    red: "from-red-500/20 to-red-600/5 border-red-500/20",
  };
  const iconColorMap: Record<string, string> = {
    blue: "text-blue-400",
    emerald: "text-emerald-400",
    purple: "text-purple-400",
    amber: "text-amber-400",
    cyan: "text-cyan-400",
    red: "text-red-400",
  };

  return (
    <div className="space-y-6">
      {/* Data flow diagram */}
      <div className="p-6 bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-xl">
        <h3 className="text-lg font-semibold text-white mb-4">Request Flow</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {["Browser", "→", "Vercel CDN", "→", "SW Check", "→", "API Function", "→", "Express Middleware", "→", "Route Handler", "→", "Drizzle ORM", "→", "Neon PostgreSQL"].map((item, i) => (
            item === "→" ? (
              <ArrowRight key={i} className="w-4 h-4 text-white/30 flex-shrink-0" />
            ) : (
              <span key={i} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/70 whitespace-nowrap">
                {item}
              </span>
            )
          ))}
        </div>
      </div>

      {/* Architecture cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {layers.map((layer) => {
          const Icon = layer.icon;
          return (
            <div
              key={layer.title}
              className={`p-5 bg-gradient-to-br ${colorMap[layer.color]} border rounded-xl`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-5 h-5 ${iconColorMap[layer.color]}`} />
                <h3 className="font-semibold text-white text-sm">{layer.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {layer.items.map((item) => (
                  <li key={item} className="text-xs text-white/60 flex items-start gap-2">
                    <span className="text-white/20 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Environment distinction */}
      <div className="p-5 bg-white/5 border border-white/10 rounded-xl">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          Environment Distinction
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-medium text-emerald-400 mb-1">Development</div>
            <p className="text-white/50 text-xs">Local dev server. Permissive CORS. Debug errors. API proxy to :8080.</p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-medium text-amber-400 mb-1">Preview</div>
            <p className="text-white/50 text-xs">Per-PR deployment. Isolated preview DB. Vercel preview URL.</p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="font-medium text-blue-400 mb-1">Production</div>
            <p className="text-white/50 text-xs">Main branch deploy. Production DB. Strict CORS. Structured error redaction.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Call Flows Section ───────────────────────────────────────────────────────

function CallFlowsSection() {
  const flows = [
    {
      title: "Starting a Focus Session",
      steps: [
        "User clicks 'Start Focus' → POST /api/sessions/start",
        "Server validates auth, checks no active session exists",
        "Creates active_sessions row with server timestamp",
        "Returns session ID + initial timer state",
        "Frontend starts local countdown timer",
        "Periodic PUT /api/sessions/sync updates focus timeline",
      ],
    },
    {
      title: "Completing a Focus Session",
      steps: [
        "Timer reaches zero → POST /api/sessions/complete",
        "Server validates idempotency key (client_nonce)",
        "Calculates actual duration from server timestamps (anti-cheat)",
        "Awards XP using sessionCompletionCore (server-authoritative)",
        "Updates streak via studyStreaksTable (transactional)",
        "Inserts coin_transactions audit record",
        "Checks achievement unlocks (battle pass, badges)",
        "Deletes active_sessions row",
        "Returns completion summary with rewards",
      ],
    },
    {
      title: "Generating Recommendations",
      steps: [
        "Frontend requests GET /api/recommendations",
        "Server fetches user's tasks, goals, sessions, streak, readiness",
        "RecommendationEngine.generate() processes signals deterministically",
        "Quiet hours → suppress all but break suggestion",
        "Spaced repetition reviews → prioritize due items",
        "Streak protection → evening reminder if no sessions today",
        "Returns top 5 recommendations with explainable reasons",
      ],
    },
    {
      title: "Deployment Version Mismatch",
      steps: [
        "Frontend attaches X-FocusArx-Deployment header to every request",
        "Server compares header with its own deployment version",
        "GET requests: allowed through (safe to retry)",
        "POST/PUT/PATCH/DELETE: blocked with 409 DEPLOYMENT_SKEW",
        "Frontend polls GET /api/deployment every 5 minutes",
        "On mismatch: shows 'Update available' banner",
        "User clicks 'Update now' → form data saved → hard refresh",
        "Service worker clears old cache on CLEAR_CACHE message",
      ],
    },
    {
      title: "Applying a Database Migration",
      steps: [
        "Developer changes Drizzle schema → generates migration SQL",
        "CI: validates migration present, no destructive changes",
        "CI: applies all migrations to empty Postgres container",
        "CI: runs integrity checks on resulting schema",
        "Deploy: acquires _migration_lock row (30-min timeout)",
        "Deploy: applies pending migrations via drizzle push",
        "Deploy: runs post-migration health check",
        "Deploy: releases lock → Vercel activates new deployment",
      ],
    },
    {
      title: "Joining a Study Room",
      steps: [
        "User requests room ticket → POST /api/study-rooms/:id/join",
        "Server validates auth, room exists, not at capacity",
        "Creates study_room_members row (idempotent by unique constraint)",
        "Issues a Socket.IO connection ticket",
        "Client connects Socket.IO with ticket → joins room namespace",
        "Server broadcasts presence update to room members",
        "Group Resonance multiplier calculated from active participants",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {flows.map((flow) => (
        <div key={flow.title} className="border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-white/5 border-b border-white/10">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              {flow.title}
            </h3>
          </div>
          <div className="p-4">
            <ol className="space-y-2">
              {flow.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 text-white/50 text-xs flex items-center justify-center font-mono">
                    {i + 1}
                  </span>
                  <span className="text-white/70 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Code Examples Section ────────────────────────────────────────────────────

function CodeExamplesSection() {
  const examples = [
    {
      title: "Check Deployment Compatibility",
      language: "bash",
      code: `# Check the current deployment version
curl -s https://focusarx.site/api/deployment | jq .

# Response:
# {
#   "version": "dpl_abc123",
#   "environment": "production",
#   "isPreview": false,
#   "timestamp": "2026-08-28T12:00:00Z"
# }`,
    },
    {
      title: "Authenticate",
      language: "bash",
      code: `# Login (returns JWT + httpOnly refresh cookie)
curl -X POST https://focusarx.site/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "secure-pass"}'

# Use the JWT for subsequent requests
TOKEN="eyJhbGciOi..."
curl https://focusarx.site/api/stats \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-FocusArx-Deployment: dpl_abc123"`,
    },
    {
      title: "Start a Focus Session",
      language: "bash",
      code: `curl -X POST https://focusarx.site/api/sessions/start \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "X-FocusArx-Deployment: dpl_abc123" \\
  -d '{
    "mode": "focus",
    "plannedDurationSec": 1500
  }'

# Response: { "sessionId": "abc-123", "secondsLeft": 1500, ... }`,
    },
    {
      title: "Complete a Session (Idempotent)",
      language: "bash",
      code: `# The client_nonce ensures this can be safely retried
curl -X POST https://focusarx.site/api/sessions/complete \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "abc-123",
    "clientNonce": "unique-random-uuid",
    "sessionStatus": "completed",
    "focusScore": 85
  }'

# Server awards XP, updates streak, grants coins — all in a transaction`,
    },
    {
      title: "Get Study Recommendations",
      language: "bash",
      code: `curl https://focusarx.site/api/recommendations \\
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "recommendations": [
#     {
#       "type": "review_topic",
#       "title": "3 reviews due",
#       "reason": "Organic Chemistry is due for review...",
#       "priority": "medium",
#       "action": { "kind": "review_flashcard", "targetId": "r1" }
#     }
#   ],
#   "signalsUsed": ["spaced_repetition", "streak_protection"],
#   "generatedAt": "2026-08-28T14:00:00Z"
# }`,
    },
    {
      title: "Check Database Health",
      language: "bash",
      code: `# Basic health check (public, no auth needed)
curl https://focusarx.site/api/healthz
# → { "status": "ok" }

# Database connectivity
curl https://focusarx.site/api/healthz/db
# → { "status": "ok", "database": true }

# Migration status
curl https://focusarx.site/api/healthz/migrations
# → { "status": "ok", "lockStatus": "unlocked" }

# Table metadata (schema only, no data)
curl https://focusarx.site/api/healthz/tables
# → { "tables": [{ "name": "users", "columnCount": 18, ... }] }`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300/80">
        <strong>Note:</strong> These examples use placeholder values. Never include real secrets or
        credentials in documentation. The <code className="px-1 py-0.5 bg-white/10 rounded text-xs">$TOKEN</code> variable
        represents a JWT obtained from the login endpoint.
      </div>

      {examples.map((ex) => (
        <div key={ex.title} className="border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-medium text-white text-sm">{ex.title}</h3>
            <span className="text-xs text-white/30 font-mono">{ex.language}</span>
          </div>
          <pre className="p-4 text-sm text-white/70 font-mono overflow-x-auto bg-black/20">
            <code>{ex.code}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
