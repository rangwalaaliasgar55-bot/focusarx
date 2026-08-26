/**
 * Centralized React Query keys
 * Ensures consistent cache invalidation and avoids mixing fetch/state for same resource
 */

export const queryKeys = {
  // Auth
  session: ["auth", "session"] as const,
  user: (userId?: string) => ["user", userId ?? "me"] as const,

  // Sessions
  sessions: {
    all: ["sessions"] as const,
    history: (limit?: number) => ["sessions", "history", limit ?? 30] as const,
    active: ["sessions", "active"] as const,
    stats: ["sessions", "stats"] as const,
  },

  // Gamification
  gamification: {
    wallet: ["gamification", "wallet"] as const,
    badges: ["gamification", "badges"] as const,
    leaderboard: (period?: string) => ["gamification", "leaderboard", period ?? "weekly"] as const,
  },

  // Tasks, Habits, Goals
  tasks: ["tasks"] as const,
  habits: {
    all: ["habits"] as const,
    completions: (date?: string) => ["habits", "completions", date ?? "today"] as const,
  },
  goals: ["goals"] as const,

  // Analytics
  analytics: {
    overview: ["analytics", "overview"] as const,
    daily: (days?: number) => ["analytics", "daily", days ?? 7] as const,
    focusTimeline: ["analytics", "focusTimeline"] as const,
  },

  // Social & Rooms
  social: {
    posts: ["social", "posts"] as const,
    feed: ["social", "feed"] as const,
  },
  rooms: {
    all: ["rooms"] as const,
    members: (roomId: string) => ["rooms", roomId, "members"] as const,
    messages: (roomId: string) => ["rooms", roomId, "messages"] as const,
  },

  // AI
  ai: {
    insights: ["ai", "insights"] as const,
    roadmap: (goal?: string) => ["ai", "roadmap", goal ?? "current"] as const,
  },

  // Misc
  notifications: ["notifications"] as const,
  missions: ["missions"] as const,
  shop: ["shop"] as const,
  marketplace: ["marketplace"] as const,
  pets: ["pets"] as const,
  city: ["city"] as const,
} as const;

// Cache invalidation rules
export const invalidationRules = {
  // When a session completes, invalidate these
  onSessionComplete: [
    queryKeys.sessions.history(),
    queryKeys.sessions.stats,
    queryKeys.gamification.wallet,
    queryKeys.analytics.overview,
    queryKeys.missions,
  ],

  // When tasks change
  onTasksChange: [queryKeys.tasks, queryKeys.analytics.overview],

  // When habits change
  onHabitsChange: [queryKeys.habits.all, queryKeys.analytics.overview],

  // When social post created
  onSocialPost: [queryKeys.social.posts, queryKeys.social.feed],
} as const;
