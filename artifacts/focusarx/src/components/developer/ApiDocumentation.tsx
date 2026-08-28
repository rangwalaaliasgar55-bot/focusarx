/**
 * API Documentation component — renders API endpoint documentation
 * organized by group. Data is structured inline since the OpenAPI spec
 * is comprehensive; this provides a human-readable summary.
 */
import { useState } from "react";
import { ChevronRight, Lock, Globe, Zap } from "lucide-react";

interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  auth: boolean;
  idempotent?: boolean;
  rateLimit?: string;
}

interface ApiGroup {
  name: string;
  description: string;
  endpoints: ApiEndpoint[];
}

const API_GROUPS: ApiGroup[] = [
  {
    name: "Authentication",
    description: "User registration, login, token refresh, password reset, and guest sessions.",
    endpoints: [
      { method: "POST", path: "/api/auth/register", description: "Create a new user account", auth: false },
      { method: "POST", path: "/api/auth/login", description: "Authenticate and receive JWT + refresh cookie", auth: false },
      { method: "POST", path: "/api/auth/refresh", description: "Rotate refresh token (silent, httpOnly cookie)", auth: false },
      { method: "POST", path: "/api/auth/logout", description: "Revoke current refresh token", auth: true },
      { method: "POST", path: "/api/auth/forgot-password", description: "Send password reset email", auth: false },
      { method: "POST", path: "/api/auth/reset-password", description: "Reset password with token", auth: false },
      { method: "POST", path: "/api/auth/guest", description: "Start a guest session", auth: false },
      { method: "POST", path: "/api/auth/onboarding", description: "Complete onboarding flow", auth: true },
    ],
  },
  {
    name: "Focus Sessions",
    description: "Start, sync, and complete timed focus sessions. Server-authoritative timing prevents cheating.",
    endpoints: [
      { method: "POST", path: "/api/sessions/start", description: "Start a new active session", auth: true, idempotent: false },
      { method: "PUT", path: "/api/sessions/sync", description: "Sync session state (timer, focus score)", auth: true, idempotent: false },
      { method: "POST", path: "/api/sessions/complete", description: "Complete session, award XP and streak credit", auth: true, idempotent: true },
      { method: "GET", path: "/api/sessions/history", description: "Paginated session history", auth: true },
      { method: "GET", path: "/api/sessions/active", description: "Current active session (if any)", auth: true },
    ],
  },
  {
    name: "Tasks",
    description: "CRUD for study tasks with priority, categories, due dates, and recurring schedules.",
    endpoints: [
      { method: "GET", path: "/api/tasks", description: "List user's tasks (with filters)", auth: true },
      { method: "POST", path: "/api/tasks", description: "Create a new task", auth: true },
      { method: "PATCH", path: "/api/tasks/:id", description: "Update task (text, priority, status)", auth: true },
      { method: "DELETE", path: "/api/tasks/:id", description: "Delete a task", auth: true },
    ],
  },
  {
    name: "Goals",
    description: "Long-term study goals with progress tracking.",
    endpoints: [
      { method: "GET", path: "/api/goals", description: "List user's goals", auth: true },
      { method: "POST", path: "/api/goals", description: "Create a new goal", auth: true },
      { method: "PATCH", path: "/api/goals/:id", description: "Update goal", auth: true },
      { method: "DELETE", path: "/api/goals/:id", description: "Delete a goal", auth: true },
    ],
  },
  {
    name: "Streaks",
    description: "Daily study streak tracking with freeze tokens for emergencies.",
    endpoints: [
      { method: "GET", path: "/api/stats/streak", description: "Current streak and history", auth: true },
      { method: "POST", path: "/api/stats/streak/freeze", description: "Use a freeze token to protect streak", auth: true },
    ],
  },
  {
    name: "XP & Gamification",
    description: "Server-authoritative XP awards, wallet balances, badges, and battle pass progress.",
    endpoints: [
      { method: "GET", path: "/api/gamification/wallet", description: "User's coin and XP balance", auth: true },
      { method: "GET", path: "/api/gamification/badges", description: "Unlocked badges", auth: true },
      { method: "GET", path: "/api/gamification/battle-pass", description: "Battle pass progress", auth: true },
      { method: "POST", path: "/api/gamification/battle-pass/claim", description: "Claim a battle pass tier", auth: true, idempotent: true },
    ],
  },
  {
    name: "Study Rooms",
    description: "Collaborative real-time study rooms with Socket.IO presence.",
    endpoints: [
      { method: "GET", path: "/api/study-rooms", description: "List active public rooms", auth: true },
      { method: "POST", path: "/api/study-rooms", description: "Create a new room", auth: true },
      { method: "POST", path: "/api/study-rooms/:id/join", description: "Join a room", auth: true },
      { method: "POST", path: "/api/study-rooms/:id/leave", description: "Leave a room", auth: true },
    ],
  },
  {
    name: "AI Coach",
    description: "AI-powered study coaching. Degrades gracefully without API keys.",
    endpoints: [
      { method: "POST", path: "/api/coach/ask", description: "Ask the AI coach a question", auth: true, rateLimit: "30/day per user" },
      { method: "GET", path: "/api/ai/insights", description: "AI-generated productivity insights", auth: true },
      { method: "GET", path: "/api/roadmap", description: "AI study roadmap for a subject", auth: true },
    ],
  },
  {
    name: "Recommendations",
    description: "Ethical, explainable study recommendations. Respects quiet hours and opt-out.",
    endpoints: [
      { method: "GET", path: "/api/recommendations", description: "Personalized study recommendations", auth: true },
    ],
  },
  {
    name: "Notifications",
    description: "In-app notifications and web push subscriptions.",
    endpoints: [
      { method: "GET", path: "/api/notifications", description: "List notifications (paginated)", auth: true },
      { method: "PATCH", path: "/api/notifications/:id/read", description: "Mark notification as read", auth: true },
      { method: "POST", path: "/api/push/subscribe", description: "Register web push subscription", auth: true },
    ],
  },
  {
    name: "Analytics",
    description: "User productivity analytics, focus DNA, and session statistics.",
    endpoints: [
      { method: "GET", path: "/api/stats", description: "Overall productivity stats", auth: true },
      { method: "GET", path: "/api/focus-dna", description: "Focus DNA archetype analysis", auth: true },
      { method: "GET", path: "/api/ai-insights", description: "Detailed AI insights report", auth: true },
    ],
  },
  {
    name: "Deployment Health",
    description: "Endpoints for monitoring deployment compatibility and database health.",
    endpoints: [
      { method: "GET", path: "/api/deployment", description: "Deployment version and compatibility info", auth: false },
      { method: "GET", path: "/api/healthz", description: "Basic health check", auth: false },
      { method: "GET", path: "/api/healthz/db", description: "Database connectivity check", auth: false },
      { method: "GET", path: "/api/healthz/migrations", description: "Migration lock status", auth: false },
      { method: "GET", path: "/api/healthz/tables", description: "Database table metadata (schema only)", auth: false },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-400 bg-emerald-500/10",
  POST: "text-blue-400 bg-blue-500/10",
  PUT: "text-amber-400 bg-amber-500/10",
  PATCH: "text-orange-400 bg-orange-500/10",
  DELETE: "text-red-400 bg-red-500/10",
};

export function ApiDocumentation() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {API_GROUPS.map((group) => (
        <div key={group.name} className="border border-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup(group.name)}
            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
          >
            <ChevronRight
              className={`w-4 h-4 text-white/40 transition-transform ${
                expandedGroups.has(group.name) ? "rotate-90" : ""
              }`}
            />
            <span className="font-medium text-white">{group.name}</span>
            <span className="text-xs text-white/40 ml-auto">
              {group.endpoints.length} endpoint{group.endpoints.length !== 1 ? "s" : ""}
            </span>
          </button>

          {expandedGroups.has(group.name) && (
            <div className="border-t border-white/10 px-4 py-3">
              <p className="text-sm text-white/60 mb-3">{group.description}</p>
              <div className="space-y-2">
                {group.endpoints.map((ep) => (
                  <div key={`${ep.method}-${ep.path}`} className="flex items-start gap-3 py-2 px-3 rounded-lg bg-white/5">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${METHOD_COLORS[ep.method]}`}
                    >
                      {ep.method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <code className="text-sm text-white/80 font-mono">{ep.path}</code>
                      <p className="text-xs text-white/50 mt-0.5">{ep.description}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {ep.auth ? (
                        <span title="Requires authentication"><Lock className="w-3.5 h-3.5 text-yellow-400" /></span>
                      ) : (
                        <span title="Public endpoint"><Globe className="w-3.5 h-3.5 text-emerald-400" /></span>
                      )}
                      {ep.idempotent && (
                        <span title="Idempotent (safe to retry)"><Zap className="w-3.5 h-3.5 text-blue-400" /></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
