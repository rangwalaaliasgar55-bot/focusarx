# FocusArx — Precise Bug-Fix & Enhancement Prompt for Bolt

> **READ THIS FIRST**: This project lives in a Replit monorepo. The frontend is at `artifacts/focusarx/src/` and the API server is at `artifacts/api-server/src/`. All file paths below are relative to the repo root. Do NOT move or restructure files.

---

## CRITICAL CONTEXT (read before touching anything)

**Tech stack:**
- Frontend: React + TypeScript + Vite + Wouter + Framer Motion + Tailwind + TanStack Query
- Backend: Express + TypeScript + Drizzle ORM + PostgreSQL
- Monorepo: pnpm workspaces — `artifacts/focusarx` (frontend), `artifacts/api-server` (backend), `lib/db` (shared schema)
- Auth: custom JWT stored in `localStorage` under key `"focusarx-auth-token"`
- Deployment: Vercel (vercel.json at repo root), but dev runs on Replit

**Known working things — DO NOT BREAK:**
- Timer logic (`usePomodoro`, `useSessionPersistence`, `syncFocusSessionToCloud`, ghost saves)
- Session recovery system (`SessionRecoveryContext`)
- Pomodoro state machine (focus/break/longBreak cycles)
- DB schema in `lib/db/src/schema/focusarx.ts`
- All existing API routes (sessions, stats, gamification, distractions, ghosts, etc.)

---

## BUG 1 — Authentication: Vite `PORT` / `BASE_PATH` crashes build on Vercel

**File:** `artifacts/focusarx/vite.config.ts`

**Problem:** The current config throws hard errors if `PORT` or `BASE_PATH` env vars are missing. On Vercel's build environment these aren't set, so the entire frontend build fails.

**Fix:** Make these non-fatal with sensible defaults:

```typescript
// artifacts/focusarx/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT ?? "5173");
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID
      ? [
          // Replit-only plugins — import dynamically so Vercel build doesn't fail
          await import("@replit/vite-plugin-runtime-error-modal").then(m => m.default()),
          await import("@replit/vite-plugin-cartographer").then(m =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
          ),
          await import("@replit/vite-plugin-dev-banner").then(m => m.devBanner()),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: isNaN(port) ? 5173 : port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT ?? "3001"}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: isNaN(port) ? 4173 : port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
```

---

## BUG 2 — Authentication: Signup doesn't auto-login (password validation mismatch)

**File:** `artifacts/focusarx/src/pages/signup.tsx`

**Problem:** The signup form requires `minLength={6}` on the password input, but the server's `registerSchema` requires `z.string().min(8)`. So a 6 or 7 character password passes client validation but gets rejected by the server with a 400 error.

**Fix:** Change the input's `minLength` to `8`:
```tsx
// In signup.tsx, change:
<input id="password" type="password" required minLength={8} ...>
//                                            ^^^^^ was 6
```

Also add a visible helper text under the password field:
```tsx
<p className="mt-1 text-xs text-zinc-500">Minimum 8 characters</p>
```

---

## BUG 3 — Authentication: Login redirects to `/dashboard` but unauthenticated users aren't protected

**File:** `artifacts/focusarx/src/App.tsx`

**Problem:** There's no route guard. After a hard refresh, `status` briefly is `"loading"`, then becomes `"unauthenticated"`, but the user stays on `/dashboard` seeing a broken empty page instead of being redirected to login.

**Fix:** Add a `ProtectedRoute` wrapper component in `App.tsx` and wrap all non-auth routes:

```tsx
// Add this component inside App.tsx (before AppWithPalette):
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
```

Then in the `<Switch>` inside `AppWithPalette`, wrap protected routes:
```tsx
// Auth routes — no protection needed:
<Route path="/login" component={LoginPage} />
<Route path="/signup" component={SignupPage} />
<Route path="/forgot-password" component={ForgotPasswordPage} />
<Route path="/reset-password" component={ResetPasswordPage} />
<Route path="/auth/callback" component={AuthCallbackPage} />

// Protected routes — wrap with ProtectedRoute:
<Route path="/" component={() => <ProtectedRoute component={HomePage} />} />
<Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
<Route path="/analytics" component={() => <ProtectedRoute component={AnalyticsPage} />} />
// ... wrap ALL non-auth routes the same way
// Exception: /onboarding should also be protected
```

---

## BUG 4 — Authentication: `GuestBootstrap` races with real auth tokens

**File:** `artifacts/focusarx/src/components/GuestBootstrap.tsx`

**Problem:** `GuestBootstrap` triggers whenever `status === "unauthenticated"`. But after a `signOut()`, status momentarily is `"unauthenticated"` before the page redirects — causing a guest token to get silently created and stored, which then overrides the logged-out state.

**Fix:** Add a location check so guest bootstrap ONLY runs on pages that allow guests (the home timer page), and skip it on auth pages:

```tsx
// artifacts/focusarx/src/components/GuestBootstrap.tsx
import { useEffect, useRef } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { useAuth, setToken } from "@/lib/auth";
import { useLocation } from "wouter";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Pages where guests should NOT be auto-created
const NO_GUEST_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback", "/onboarding", "/admin"];

export function GuestBootstrap() {
  const { status, refresh } = useAuth();
  const [location] = useLocation();
  const ran = useRef(false);

  useEffect(() => {
    // Don't create guests on auth pages
    if (NO_GUEST_PATHS.some(p => location.startsWith(p))) return;
    if (ran.current) return;
    if (status !== "unauthenticated") return;
    ran.current = true;

    const run = async () => {
      let key = localStorage.getItem(STORAGE_KEYS.guestKey);
      if (!key) {
        key = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEYS.guestKey, key);
      }

      const waits = [0, 400, 1200, 2500];
      for (let i = 0; i < waits.length; i++) {
        if (waits[i]! > 0) await sleep(waits[i]!);
        try {
          const res = await fetch("/api/auth/guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guestKey: key }),
          });
          if (res.ok) {
            const data = await res.json() as { token?: string };
            if (data.token) {
              setToken(data.token);
              await refresh();
              break;
            }
          }
        } catch { /* retry */ }
      }
    };

    void run();
  }, [status, refresh, location]);

  return null;
}
```

---

## BUG 5 — AI Coach (CoachPanel): Shows "Set ANTHROPIC_API_KEY" error, needs graceful fallback

**File:** `artifacts/focusarx/src/components/CoachPanel.tsx`

**Problem:** When `ANTHROPIC_API_KEY` is not set, the panel shows an ugly "Set ANTHROPIC_API_KEY" dev message to end users. The server returns a 503 with `"AI Coach not configured"`. The coach should still work with a built-in fallback response engine.

**Fix — Server side** (`artifacts/api-server/src/routes/coach.ts`):

Replace the hard 503 error with a smart local fallback when the API key is missing:

```typescript
// In /coach/chat route, replace the early return with:
if (!apiKey) {
  // Fallback: context-aware local responses
  const fallbackReplies = [
    "Focus on one task at a time — multitasking reduces efficiency by up to 40%.",
    "Try the 2-minute rule: if something takes less than 2 minutes, do it now.",
    "Your next Pomodoro session is your most important one. Start it.",
    "Break your goal into the smallest possible next step and do just that.",
    "Deep work requires uninterrupted blocks. Protect your focus time fiercely.",
    "Review what you accomplished today — recognizing progress fuels motivation.",
  ];
  const reply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)]!;
  res.json({ reply, fallback: true });
  return;
}
```

**Fix — Frontend side** (`artifacts/focusarx/src/components/CoachPanel.tsx`):

Remove the `unconfigured` state and the ugly "Set ANTHROPIC_API_KEY" message. When `fallback: true` is in the response, show a subtle "Basic mode" indicator instead of a broken state:

```tsx
// Remove the unconfigured state entirely.
// Add a isFallback state:
const [isFallback, setIsFallback] = useState(false);

// In the send() function, after getting the response:
const d = await r.json() as { reply?: string; error?: string; fallback?: boolean };
if (d.fallback) setIsFallback(true);

// In the panel header, add a subtle indicator when fallback:
{isFallback && (
  <span className="ml-auto text-[9px] text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">Basic</span>
)}
// Remove the red dot / green dot status indicator entirely
```

---

## BUG 6 — AI Roadmap: Works but requires auth — shows confusing "connecting session" message

**File:** `artifacts/focusarx/src/pages/roadmap.tsx`

**Problem:** The roadmap page shows `"Connecting your session… If this stays stuck, refresh the page."` while `authStatus === "unauthenticated"`. But this message stays forever for guest users who haven't been bootstrapped yet, and even for a logged-in user it shows briefly during the `"loading"` state.

**Fix:** Improve the status messaging and allow generating a roadmap while loading (it will fail with 401 if truly unauthed, which is handled):

```tsx
// Replace the confusing auth status messages in the aside:
{authStatus === "loading" && (
  <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
    <span className="h-3 w-3 animate-spin rounded-full border border-zinc-700 border-t-zinc-400" />
    Connecting…
  </p>
)}
// Remove the "unauthenticated" warning entirely — GuestBootstrap handles it silently

// Also fix the button — allow clicking while loading (let the server return 401 if needed):
<motion.button
  type="button"
  disabled={loading} // Only disable during generation, not during auth loading
  onClick={() => void generate()}
  ...
>
```

---

## BUG 7 — Admin: `ADMIN_PASSWORD` not set in dev → entire admin panel says "not configured"

**File:** `artifacts/api-server/src/lib/config.ts` + `artifacts/focusarx/src/components/admin/AdminGate.tsx`

**Problem:** In dev, if `ADMIN_PASSWORD` isn't in `.env`, the `/api/admin/auth` endpoint returns 503 "not configured". The `AdminGate` component then shows "Could not reach server" because it catches all non-OK responses as the same error.

**Fix — Config:** In dev mode, provide a default admin password:
```typescript
// In getServerConfig(), change adminPassword:
const adminPassword: string | null =
  process.env.ADMIN_PASSWORD ?? (!isProduction ? "admin123" : null);
```

**Fix — AdminGate:** Show the specific error message from the server:
```tsx
// In AdminGate.tsx submit(), replace the error handling:
if (!res.ok) {
  const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
  if (data.hint) {
    setError(`${data.error ?? "Access denied"} — ${data.hint}`);
  } else {
    setError(data.error ?? "Access denied");
  }
  return;
}
```

Also add a dev hint below the form in AdminGate when in development:
```tsx
{process.env.NODE_ENV !== "production" && (
  <p className="mt-4 text-center text-xs text-zinc-700">
    Dev default: <code className="text-zinc-600">admin123</code> (set ADMIN_PASSWORD to change)
  </p>
)}
```

---

## BUG 8 — Admin: Role-based auth check works but `checkAuth` hits DB on every admin request

**File:** `artifacts/api-server/src/routes/admin.ts`

**Problem:** `checkAuth()` does a DB query on every single admin route call. There's also a subtle bug: the admin cookie JWT uses `getJwtSecret()` which can return `"admin-dev-secret"` as fallback in production if `AUTH_SECRET` isn't set, creating a security hole.

**Fix:**
```typescript
// In admin.ts, make getJwtSecret() use a dedicated admin secret:
function getJwtSecret(): string {
  const config = getServerConfig();
  // Use AUTH_SECRET for admin tokens too — it's always set in prod
  return config.jwtSecret ?? "admin-dev-secret-change-in-prod";
}

// Add in-memory cache for admin auth (valid for 5 minutes per userId):
const adminAuthCache = new Map<string, number>(); // userId -> expiry timestamp

async function checkAuth(req: any): Promise<boolean> {
  // Cookie-based admin session (password login)
  if (isAdminAuthed(req)) return true;
  
  // JWT-based (user with role=admin)
  const userId = extractUserId(req);
  if (!userId) return false;
  
  // Check cache first
  const cached = adminAuthCache.get(userId);
  if (cached && cached > Date.now()) return true;
  
  try {
    const [user] = await db.select({ role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, userId));
    const isAdmin = user?.role?.toLowerCase() === "admin";
    if (isAdmin) adminAuthCache.set(userId, Date.now() + 5 * 60 * 1000);
    return isAdmin;
  } catch { return false; }
}
```

---

## ENHANCEMENT 1 — UI: Auth pages need a proper dark theme

**Files:** `artifacts/focusarx/src/pages/login.tsx`, `artifacts/focusarx/src/pages/signup.tsx`

**Problem:** Both pages use a plain white background (`bg-zinc-100` submit button, no background styling on the page itself). They look completely unstyled against the dark app.

**Fix — Login page:** Wrap in the dark background and add the purple glow:
```tsx
// Replace the return in LoginPage with a proper dark-themed wrapper:
// The AuthCard component already has proper dark card styling.
// The page wrapper just needs the forge background:
return (
  <div className="relative min-h-screen overflow-hidden forge-bg-glow flex items-center justify-center px-4">
    <div className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute -left-24 top-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.12),transparent_70%)] blur-3xl" />
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.08),transparent_70%)] blur-3xl" />
    </div>
    <div className="relative z-10 w-full max-w-md">
      <AuthCard title="Welcome back" subtitle="Sign in to sync sessions and analytics" footer={...}>
        {/* existing form content */}
      </AuthCard>
      {/* Add Google OAuth button below the form */}
      <div className="mt-4">
        <div className="relative flex items-center justify-center">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="mx-3 text-xs text-zinc-600">or</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>
        <a
          href="/api/auth/google"
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-700 bg-zinc-900/50 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </a>
      </div>
    </div>
  </div>
);
```

Apply the same dark background wrapper to `signup.tsx`.

---

## ENHANCEMENT 2 — UI: CoachPanel floating button position conflicts with mobile bottom nav

**File:** `artifacts/focusarx/src/components/CoachPanel.tsx`

**Problem:** The coach button is at `bottom-24 right-5 md:bottom-8` — on mobile, `bottom-24` (96px) may overlap with the bottom navigation bar which is 64px tall, and the panel expands to `bottom-40 md:bottom-24` which can overflow off screen.

**Fix:**
```tsx
// Coach button: move up on mobile to clear bottom nav
className="fixed bottom-28 right-4 z-40 ... md:bottom-10 md:right-6"

// Coach panel: anchor from the button, constrained height
className="fixed bottom-44 right-4 z-40 flex w-[340px] max-sm:w-[calc(100vw-2rem)] max-h-[420px] flex-col rounded-2xl ... md:bottom-28 md:right-6"
```

---

## ENHANCEMENT 3 — UI: Add visual polish to the AppShell sidebar

**File:** `artifacts/focusarx/src/components/AppShell.tsx`

Keep all existing logic. Make these targeted visual improvements:

**1. Add an "Admin" nav item** for users with `role === "admin"` (it's missing from NAV_ITEMS):
```tsx
// In AppShell.tsx, after the imports, update NAV_ITEMS to add admin conditionally:
// In the nav rendering section, after the NAV_ITEMS.map(), add:
{session?.user && (session.user as any).role === "admin" && (
  <NavItem
    href="/admin"
    label="Admin"
    icon={Shield}
    active={location === "/admin"}
  />
)}
```

**2. Show real user data in sidebar footer** — currently shows email split at `@`, but should show name if available:
```tsx
// In the desktop sidebar user section, the name display is already correct.
// Add the user's email in a smaller muted line:
<p className="truncate text-xs font-medium text-[#E2E8F0]">
  {user.name || user.email?.split("@")[0] || "User"}
</p>
<p className="truncate text-[10px] text-[#4B5563]">
  {user.isGuest ? "Guest session" : user.email}
</p>
```

**3. Add Framer Motion `whileHover` to NavItem:**
```tsx
// In NavItem component, wrap the Link in a motion.div:
import { motion } from "framer-motion";

// Change Link to be wrapped:
<motion.div whileHover={{ x: 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>
  <Link href={href} onClick={onClick} className={...}>
    {/* existing content */}
  </Link>
</motion.div>
```

---

## ENHANCEMENT 4 — Roadmap page UX improvements

**File:** `artifacts/focusarx/src/pages/roadmap.tsx`

Keep all existing generate logic. Add these improvements:

**1. Week-style header for each day card:**
```tsx
// In the day card header, add phase context:
<h3 className="text-lg font-semibold text-zinc-50">
  Day {day.day}
  {day.focusSessions[0] && (
    <span className="ml-2 text-sm font-normal text-zinc-500">
      — {day.focusSessions[0].split("—")[0]?.trim()}
    </span>
  )}
</h3>
```

**2. Session count badge + time estimate chip:**
```tsx
<div className="flex items-center gap-2">
  <span className="rounded-full bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 text-[10px] text-indigo-400">
    {day.focusSessions.length} sessions
  </span>
  <span className="text-xs text-zinc-500">~{day.estimatedTime} min</span>
</div>
```

**3. Task checkboxes (client-side only, no persistence needed):**
```tsx
// Add a local Set state for checked tasks:
const [checked, setChecked] = useState<Set<string>>(new Set());

// In the tasks list, render checkboxes:
<ul className="mt-2 space-y-1.5">
  {day.tasks.map((t) => {
    const key = `${day.day}-${t}`;
    const done = checked.has(key);
    return (
      <li key={t} className="flex items-center gap-2 cursor-pointer" onClick={() => {
        setChecked(prev => {
          const next = new Set(prev);
          done ? next.delete(key) : next.add(key);
          return next;
        });
      }}>
        <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${done ? "bg-emerald-500 border-emerald-500" : "border-zinc-700"}`}>
          {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </span>
        <span className={`text-sm ${done ? "line-through text-zinc-600" : "text-zinc-300"}`}>{t}</span>
      </li>
    );
  })}
</ul>
```

---

## ENHANCEMENT 5 — Global: Custom scrollbar + toast improvements

**File:** `artifacts/focusarx/src/index.css`

Add at the end of the file:
```css
/* Custom scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.45); }

/* Keyboard focus ring */
:focus-visible {
  outline: 2px solid rgba(124,58,237,0.6);
  outline-offset: 2px;
  border-radius: 4px;
}
```

---

## ENHANCEMENT 6 — Performance: Add `loading="lazy"` to logo and avoid layout shift

**File:** `artifacts/focusarx/src/components/AppShell.tsx`

```tsx
// In LogoMark, add loading="lazy" and explicit dimensions:
<img
  src="/logo.png"
  alt="FocusArx Logo"
  className={`${imgSize} rounded-full object-cover drop-shadow-[0_0_8px_rgba(147,51,234,0.5)]`}
  loading="lazy"
  width={size === "small" ? 28 : 36}
  height={size === "small" ? 28 : 36}
/>
```

---

## ENVIRONMENT VARIABLES CHECKLIST

Make sure these are set in Vercel (and `.env` for dev):

```env
# Required for auth to work
DATABASE_URL=postgresql://...
AUTH_SECRET=a-random-32-char-string

# Required for AI Coach (optional — has fallback without it)
ANTHROPIC_API_KEY=sk-ant-...

# Required for Google OAuth (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# App URL (critical for OAuth redirect)
APP_URL=https://your-app.vercel.app

# Admin panel
ADMIN_PASSWORD=your-secure-password
```

---

## SUMMARY — What to implement in order:

1. **BUG 1** — Fix `vite.config.ts` to not crash without `PORT`/`BASE_PATH` ← This is why Vercel builds fail
2. **BUG 2** — Fix signup password `minLength` from 6 → 8 ← Easy 1-line fix
3. **BUG 3** — Add `ProtectedRoute` wrapper in `App.tsx` ← Fixes the blank dashboard after refresh
4. **BUG 4** — Fix `GuestBootstrap` to skip auth pages ← Fixes guest token overriding signout
5. **BUG 5** — Add fallback to coach route + remove "Set API key" error UI ← Users see something useful
6. **BUG 6** — Fix roadmap auth messaging ← Quick UX polish
7. **BUG 7** — Add default dev `ADMIN_PASSWORD` + better error in AdminGate ← Fix dev workflow
8. **BUG 8** — Add admin auth cache ← Performance fix
9. **ENHANCEMENT 1** — Dark theme on auth pages + Google OAuth button ← Visual
10. **ENHANCEMENT 2** — Coach panel mobile positioning ← Mobile UX fix
11. **ENHANCEMENT 3** — Admin nav item + sidebar user email display + NavItem hover animation
12. **ENHANCEMENT 4** — Roadmap task checkboxes + session count badges
13. **ENHANCEMENT 5** — Custom scrollbar CSS
14. **ENHANCEMENT 6** — Logo lazy loading

