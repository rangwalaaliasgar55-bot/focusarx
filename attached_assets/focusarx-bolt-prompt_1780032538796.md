# FocusArx — Bolt Enhancement Prompt

> Paste this entire prompt into Bolt. It covers UI upgrades, auth fixes, AI features via Ollama, and all known bugs.

---

## CONTEXT

This is **FocusArx**, a dark-themed Study OS built with React + TypeScript + Wouter + Framer Motion + Drizzle ORM (PostgreSQL). The design language uses a deep navy/charcoal base (`#08091C`) with purple accent (`#7C3AED` / `#A78BFA`). The app has a sidebar on desktop and a bottom tab bar + slide-out drawer on mobile.

---

## PART 1 — BUG FIXES (Critical, do these first)

### 1A. Authentication is broken
- The auth flow (`/login`, `/signup`, `/forgot-password`, `/auth/callback`) is not working correctly.
- Fix the `useAuth()` hook so `session`, `status` (`"loading" | "authenticated" | "unauthenticated"`), `signIn`, `signOut`, and `signUp` all work reliably.
- Ensure the auth token is stored in `localStorage` under the key `"focusarx-auth-token"`.
- After login/signup, redirect the user to `/` (the Timer page).
- After signout, clear the token and redirect to `/login`.
- Show a loading spinner while `status === "loading"` — do not flash the login page.
- Protect all routes except `/login`, `/signup`, `/forgot-password` — redirect unauthenticated users to `/login`.
- Fix the `/auth/callback` handler to correctly exchange the code for a session and store the token.

### 1B. AI Study Roadmap (`/roadmap`) is not working
- The `/roadmap` page calls an AI endpoint that is currently broken/missing.
- Replace the backend call with **Ollama** running locally at `http://localhost:11434`.
- Use the model `llama3` (or `mistral` as fallback — try llama3 first, catch errors and fall back).
- The roadmap generator should:
  1. Accept a subject/goal from the user (text input).
  2. POST to `http://localhost:11434/api/generate` with:
     ```json
     {
       "model": "llama3",
       "prompt": "Create a detailed, week-by-week study roadmap for: [USER_INPUT]. Format as JSON with keys: title, weeks (array of { weekNumber, theme, topics[], dailyGoal, resources[] }). Return only valid JSON, no markdown.",
       "stream": false
     }
     ```
  3. Parse the JSON response and render it as a beautiful timeline/roadmap UI.
  4. Show a loading skeleton while generating.
  5. If Ollama is unreachable, show a friendly error: "AI is offline — make sure Ollama is running locally."
- The roadmap timeline UI should show each week as a card with: week number badge, theme title, topics as chips, daily goal, and resource links.

### 1C. AI Copilot (`CoachPanel`) is not working
- `CoachPanel` (rendered in `AppShell` when authenticated) is the AI coach sidebar/panel.
- Replace any broken AI calls with **Ollama** at `http://localhost:11434`.
- The copilot should:
  1. Be a collapsible panel (button in bottom-right corner: sparkle icon, purple gradient).
  2. Open as a slide-up panel or right-side drawer (280px wide on desktop, full-width sheet on mobile).
  3. Have a chat interface: message history + input box + send button.
  4. Use this system prompt for Ollama:
     ```
     You are FocusArx AI Coach — a focused, motivating study assistant. Keep responses concise (max 3 sentences unless asked for detail). Help with study strategies, focus techniques, time management, and subject explanations. Be warm but direct.
     ```
  5. POST to `http://localhost:11434/api/chat` with:
     ```json
     {
       "model": "llama3",
       "messages": [{ "role": "system", "content": "..." }, ...conversationHistory],
       "stream": false
     }
     ```
  6. Show typing indicator (3 animated dots) while waiting for response.
  7. Store conversation history in component state (last 20 messages max).
  8. If Ollama is unreachable, show: "AI Copilot offline — start Ollama to enable."

### 1D. Admin page (`/admin`) is broken
- Fix the admin page so it:
  1. Only renders for users where `user.isAdmin === true`. All other users see a "403 — Not Authorized" message.
  2. Displays a simple dashboard: total users count, total sessions count, sessions today, active users today.
  3. Fetches this data from `/api/admin/stats` (create this endpoint if missing).
  4. Uses the same dark theme as the rest of the app.

---

## PART 2 — UI UPGRADES

### 2A. AppShell Sidebar — Visual Upgrade
Enhance `AppShell.tsx` (keep all existing logic, only improve visuals):

- **Sidebar background**: Change from solid dark to a glassmorphism effect:
  ```css
  background: rgba(8, 12, 28, 0.85);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(124, 58, 237, 0.12);
  ```
- **Logo area**: Add a subtle animated glow ring around the logo image — a pulsing `box-shadow: 0 0 0 2px rgba(124,58,237,0.4)` that pulses every 3 seconds.
- **Nav items**: 
  - Active item: add a left accent bar (already exists) + subtle background shimmer animation on first render.
  - Hover: smooth 150ms transition with a faint purple shimmer.
  - Add Framer Motion `whileHover={{ x: 2 }}` micro-interaction.
- **User section at bottom**: 
  - Show the user's avatar with initials inside a gradient circle (already exists).
  - Add a small green dot (online indicator) on the avatar when authenticated.
  - Add `user.email` below the name in a muted color.
- **Sidebar width**: Keep at 240px but add a subtle gradient overlay at the bottom of the nav list for overflow scroll fade.
- **Mobile drawer**: Add a subtle purple gradient line at the top of the drawer for visual polish.

### 2B. Timer Page — Visual Upgrade
Enhance `Timer.tsx` (keep all existing logic):

- **Timer card**: 
  - Add a subtle animated gradient border that rotates when the timer is running:
    ```css
    background: conic-gradient(from var(--angle), transparent 70%, rgba(124,58,237,0.4) 100%);
    ```
    Use a CSS `@property --angle` animation when `status === "running"`.
  - Add a very subtle noise texture overlay to the card background using SVG filter.
- **Mode selector pill**: Add a smooth color-tinted shadow under the active pill matching the mode (rose for focus, emerald for break, sky for longBreak).
- **Timer display (ring)**: 
  - When running, add a soft pulsing glow on the ring in the mode's accent color.
  - When complete (justCompleted), flash the ring with a bright white glow + scale animation.
- **Session type badge**: Make it more prominent — gradient pill with an emoji icon per type:
  - `deep_work` → 🧠, `creative` → 🎨, `review` → 📖, `recharge` → 🌊
- **Focus blocks today counter**: Upgrade to a mini progress bar showing blocks toward daily goal (e.g., 4/6).
- **Controls**: 
  - Play button: larger (56px), gradient background (`from-[#7C3AED] to-[#4F46E5]`), subtle box-shadow glow.
  - Hover state: brighten + slight scale up (`scale: 1.05`).
  - Add a haptic-style spring animation on click.

### 2C. Global Improvements

- **Page transitions**: Wrap all route content in a Framer Motion `AnimatePresence` with:
  ```tsx
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -4 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
  ```
- **Scrollbar**: Add a custom thin purple scrollbar globally:
  ```css
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.3); border-radius: 2px; }
  ```
- **Focus state**: All focusable elements should have `outline: 2px solid rgba(124,58,237,0.5); outline-offset: 2px` on keyboard focus.
- **Toast notifications**: Upgrade to slide-in-from-right toasts with an icon (✅ success, ℹ️ info, ❌ error) and a progress bar that depletes over the toast duration.
- **Empty states**: All pages with no data should show a beautiful empty state with an icon, title, and CTA (not just a blank page).
- **Loading skeletons**: Replace all blank loading states with animated shimmer skeletons that match the expected content shape.

### 2D. Dashboard Page (`/dashboard`) Enhancement
- Add a "Study Streak" card at the top — show current streak days with a fire emoji and a mini calendar heatmap (last 30 days, green/purple shading for active days).
- Add a "Today's Goal" progress ring showing focus blocks completed vs. target.
- Add a "Recent Sessions" table with columns: Date, Duration, Mode, Session Type, and a sparkline of the focus timeline.

### 2E. AI Roadmap Page (`/roadmap`) — Full UI
Build a polished roadmap UI after the AI generates the plan:
- Header: Subject title + "Generated by AI" badge + "Regenerate" button.
- Timeline: Vertical timeline with week cards. Each card has:
  - Week number circle badge (purple gradient).
  - Theme title in large text.
  - Topics as rounded chips (`bg-purple-950/50 text-purple-300 border border-purple-800/40`).
  - Daily goal highlighted in a yellow/amber callout box.
  - Resources as clickable link pills.
- Add a "Save Roadmap" button that persists it to the database via `/api/roadmap` (create this endpoint).
- Add a "Saved Roadmaps" section below showing previously saved roadmaps with a delete button.

---

## PART 3 — DATABASE (Drizzle / PostgreSQL)

The DB connection is in `db/index.ts` — keep this file exactly as-is:
```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
// ... (lazy proxy pattern — do not change)
```

Add these schema additions to `db/schema.ts` if not already present:
```typescript
// AI Roadmaps
export const roadmaps = pgTable("roadmaps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  subject: text("subject").notNull(),
  data: jsonb("data").notNull(), // the full roadmap JSON
  createdAt: timestamp("created_at").defaultNow(),
});

// Run migration: npx drizzle-kit push
```

---

## PART 4 — OLLAMA INTEGRATION UTILITY

Create `/client/src/lib/ollama.ts`:
```typescript
const OLLAMA_BASE = "http://localhost:11434";

export async function ollamaGenerate(prompt: string, model = "llama3"): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.response as string;
}

export async function ollamaChat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  model = "llama3"
): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.message?.content as string;
}

export async function isOllamaOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
```

---

## PART 5 — TECHNICAL NOTES

- **Do not break** existing Timer logic, Pomodoro hook, session persistence, sync, ghost saves, or distraction modal.
- **Keep** all existing route structure in `AppShell.tsx` (`NO_SHELL` list, nav items, bottom tab bar).
- **Keep** the `db/index.ts` lazy proxy pattern exactly as-is — do not refactor it.
- **TypeScript**: Fix any type errors introduced. Do not use `any` unless strictly necessary.
- **Framer Motion**: Already installed — use it for all new animations.
- **Tailwind**: Already configured — use Tailwind for all new styles. Use arbitrary values (`bg-[#08091C]`) for brand colors.
- **Error boundaries**: Wrap the AI Roadmap and AI Copilot in React error boundaries so a crash in AI components doesn't take down the whole app.
- **Responsive**: All new UI must work on mobile (375px+) and desktop (1280px+).
- **Accessibility**: All interactive elements need `aria-label`. Modals need `role="dialog"` and focus trap.

---

## SUMMARY OF DELIVERABLES

| # | Item | Priority |
|---|------|----------|
| 1 | Fix authentication (login/signup/signout/protected routes) | 🔴 Critical |
| 2 | Fix AI Roadmap using Ollama llama3 | 🔴 Critical |
| 3 | Fix AI Copilot (CoachPanel) using Ollama | 🔴 Critical |
| 4 | Fix Admin page (auth guard + stats) | 🟡 High |
| 5 | AppShell sidebar glassmorphism + micro-interactions | 🟡 High |
| 6 | Timer card animated border + glow when running | 🟡 High |
| 7 | Global page transitions + custom scrollbar | 🟢 Medium |
| 8 | Toast upgrade (slide-in + progress bar) | 🟢 Medium |
| 9 | Dashboard streak heatmap + goal ring | 🟢 Medium |
| 10 | Roadmap timeline UI + save/load | 🟢 Medium |
| 11 | Ollama utility file `/lib/ollama.ts` | 🔴 Critical |
| 12 | DB schema: roadmaps table | 🟡 High |
