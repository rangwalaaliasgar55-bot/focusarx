# FocusArx Master Blueprint: The Comprehensive Modernization & Engineering Plan

## AI Provider Stack

**Primary Provider: Gemini (Google)**  
**Fallback Provider: Groq**

All AI features use Gemini as the base provider. Groq is the secondary/fallback provider. No OpenAI dependency exists in this codebase.

> Note: Groq's API endpoint URL contains "openai" (`api.groq.com/openai/v1/...`) because Groq implements an OpenAI-compatible API format for developer convenience. This is NOT an OpenAI call — it is Groq's own inference API running Llama models. The actual AI provider chain is: **Gemini → Groq → Template Fallback**.

---

## 1. Executive Summary & Repository State Assessment

FocusArx is an ambitious, full-stack cognitive performance and deep work operating system. Combining scientific study methodologies (Pomodoro, Spaced Repetition, Feynman Technique) with 3D gamification (Three.js city, low-poly companion pets, battle pass) and multimodal AI coaching (Gemini 2.5 Flash, Groq, on-device MediaPipe vision), it possesses a strong foundation.

### Current Architectural Scorecard

| Area | Current Grade | Target Grade | Key Gap |
|---|---|---|---|
| 1. Core Focus Engine | 8.0/10 | 10.0/10 | Worker drift/tabs |
| 2. Backend & DB Architecture | 8.5/10 | 10.0/10 | OpenAPI drift |
| 3. AI & Intelligent Agent | 7.5/10 | 10.0/10 | Lack of SSE stream |
| 4. Gamification & 3D WebGL | 8.0/10 | 10.0/10 | LOD / Three chunk |
| 5. Frontend & UI/UX Modular | 7.0/10 | 9.8/10 | Monolithic Timer |
| 6. Realtime & Multiplayer | 7.5/10 | 9.8/10 | WebRTC / scaling |
| 7. Mobile PWA & Offline | 6.5/10 | 9.9/10 | Background sync |
| 8. Testing, CI/CD & DX | 7.0/10 | 9.9/10 | Playwright E2E |

---

## 2. Critical Fixes & Urgent Technical Debt (P0)

### 2.1 Web Worker Timer Drift Prevention

**Location**: `artifacts/focusarx/src/hooks/usePomodoro.ts` (lines 150–180), `artifacts/focusarx/src/components/Timer.tsx`

**Problem**: Browsers (especially iOS Safari, Chrome on Android, and background desktop tabs) throttle `window.setInterval` to 1000ms or suspend execution entirely during sleep/tab switching. While timestamp delta math prevents total time loss, active state updates, sound cues, and phase transitions freeze until the tab is refocused.

**Fix**:
- Create a dedicated inline Web Worker (`timer.worker.ts`) using standard `postMessage` ticks.
- Fall back to Web Audio clock ticks (`AudioContext.currentTime`) when Web Workers are unavailable.
- Emit ticks at 100ms intervals to ensure millisecond-precise UI interpolation and background audio chimes.

### 2.2 Playwright Test Infrastructure & Axe-Core Accessibility

**Location**: `tests/e2e/accessibility.spec.ts`, `playwright.config.ts`

**Problem**: Playwright browser download timeouts occur in CI/restricted network environments, blocking automated WCAG verification.

**Fix**:
- Add a headless `@axe-core/cli` or JSDOM/Puppeteer script fallback inside `package.json` (`pnpm test:a11y:fast`).
- Implement an automated pre-render HTML validation step that scans the 69 static prerendered routes (`artifacts/focusarx/dist/public/*.html`) directly with axe-core without requiring a full Chromium launch.

### 2.3 OpenAPI Contract Sync & Type-Safe Client Generation

**Location**: `lib/api-spec/openapi.yaml`, `lib/api-client-react`, `lib/api-zod`

**Problem**: `openapi.yaml` defines 26 route paths, whereas the backend Express router (`artifacts/api-server/src/routes/index.ts`) mounts 75+ endpoints across 55 route modules.

**Fix**:
- Consolidate all route definitions into `openapi.yaml` using Ts-to-OpenAPI tooling or Drizzle-Zod schema mirrors.
- Run `pnpm --filter @workspace/api-spec generate` via Orval to export React Query hooks for every endpoint, eliminating raw `fetch()` calls in frontend pages.

### 2.4 Race Conditions in Virtual Currency & Token Ledgers

**Location**: `artifacts/api-server/src/lib/tokenLedger.ts`, `artifacts/api-server/src/lib/coinLedger.ts`, `artifacts/api-server/src/routes/marketplace.ts`

**Problem**: Simultaneous purchases or reward claims can cause double-spend race conditions without transactional row-level locking.

**Fix**:
- Wrap all balance deductions and credit transactions inside `db.transaction(async (tx) => { ... })`.
- Apply SQL row locking: `SELECT balance FROM user_wallets WHERE user_id = $1 FOR UPDATE`.
- Ensure idempotency nonces (`clientNonce`) are uniquely constrained in `coin_transactions` and `token_ledger`.

---

## 3. Core Focus Engine & Scientific Study Architecture

### 3.1 Adaptive Ultradian & Flow-State Timing Engine

**Current**: Static 25m focus / 5m break / 15m long break.

**Modern Enhancement**:
- **Ultradian 90/20 & Flow Modes**: Implement Huberman/Kleitman 90-minute ultradian rhythm options with adaptive ramp-up (5m warm-up, 80m deep work, 5m cool-down).
- **Flow Shield**: If the user is actively typing or tracking tasks when the timer hits 00:00, present a non-intrusive "Extend Flow State (+15m)" prompt without jarring alarms.
- **Cognitive Fatigue Prediction**: Use historical session data from `productivityLogsTable` to calculate optimal session durations based on the user's focus DNA peak hours.

### 3.2 Web Audio Binaural Beats & Spatial Sound Engine

**Location**: `artifacts/focusarx/src/components/SoundEngine.tsx`, `AmbientSoundBar.tsx`

**Enhancements**:
- **True Binaural Brainwave Synthesizer**: Generate stereo carrier waves (e.g., Left Ear: 432 Hz, Right Ear: 442 Hz = 10 Hz Alpha Wave for Flow State).
- **Isochronic Tones & Pink/Brownian Noise Filters**: Procedural Web Audio API nodes with dynamic low-pass filters.
- **Spatial 3D Audio Pan**: Pan ambient sounds around the virtual soundstage using `PannerNode`.

### 3.3 Cross-Tab & Cross-Device State Machine

**Implementation**:
- Utilize `BroadcastChannel("focusarx_timer_bus")` API to synchronize timer states across multiple open tabs.
- Leverage the Web Locks API (`navigator.locks.request("focusarx_active_timer")`) to ensure only one tab controls sound generation and API synchronization.

### 3.4 Private On-Device Vision (MediaPipe) Upgrade

**Location**: `artifacts/focusarx/src/components/camera/FocusCamera.tsx`

**Enhancements**:
- **Blink Rate & Eye Strain Detection**: Calculate Eye Aspect Ratio (EAR) locally via WebAssembly to suggest the 20-20-20 rule.
- **Posture Corrector**: Estimate shoulder and nose-level offsets to notify users when slouching without recording or transmitting any video.

---

## 4. Next-Generation AI Intelligence ("Arx OS 2.0")

> **AI Provider**: Gemini 2.5 Flash (primary) → Groq Llama-3-70b (fallback) → Local templates (last resort)

### 4.1 Server-Sent Events (SSE) Real-Time AI Coaching

**Location**: `artifacts/api-server/src/routes/ai.ts`, `coach.ts`, `arx.ts`

**Problem**: Current AI interactions are blocking JSON requests with 8–25s latencies.

**Modern Enhancement**:
- Create `/api/ai/stream` endpoint supporting streaming Server-Sent Events (`text/event-stream`).
- Stream tokens from **Gemini 2.5 Flash** / **Groq Llama-3-70b** directly to `CoachPanel.tsx` and `AskArx.tsx` for immediate sub-200ms TTFT (Time To First Token).
- Provide local heuristic fallback streaming for zero-API-key deployments.

### 4.2 FSRS (Free Spaced Repetition Scheduler) Flashcards

**Location**: `artifacts/focusarx/src/pages/flashcards.tsx`, `artifacts/api-server/src/routes/flashcards.ts`

**Enhancements**:
- Upgrade from standard 5-box Leitner to FSRS-4.5 (measuring Difficulty D, Stability S, and Retrievability R).
- Add AI auto-generation from PDF/Markdown study materials (`POST /api/flashcards/generate-deck`).
- Interactive card flip physics with 3D perspective transforms and keyboard shortcuts.

### 4.3 Interactive Multi-Turn Feynman Technique Tutor

**Location**: `artifacts/focusarx/src/pages/feynman-technique.tsx`

**Enhancements**:
- Turn the static Feynman guide into a dynamic AI conversation powered by **Gemini**:
  1. User inputs a complex concept.
  2. Arx asks the user to explain it as if to an 8-year-old child.
  3. AI pinpoints jargon, missing links, and analogies.
  4. AI produces a "Clarity Index" (0–100%) and generates conceptual flashcards.

### 4.4 Autonomous AI Task Breakdown (Atomic Pomodoro Planner)

**Location**: `artifacts/focusarx/src/pages/tasks.tsx`, `artifacts/api-server/src/routes/tasks.ts`

**Feature**:
- Add a "✨ Decompose with AI" button on any task (powered by **Gemini**).
- Breaks ambiguous goals into 15–25 min atomic Pomodoro micro-tasks with estimated time and acceptance criteria.

---

## 5. 3D Gamification, Virtual Worlds & Social Multiplayer

### 5.1 3D Focus City V2 (Three.js / React Three Fiber)

**Location**: `artifacts/focusarx/src/pages/city.tsx`, `artifacts/focusarx/src/components/Hero3D.tsx`

**Enhancements**:
- **Procedural Architecture by Study Domain**: STEM sessions spawn Solar Observatories, Arts spawn Libraries, Health spawns Zen Gardens.
- **Level of Detail (LOD) & Instanced Mesh Performance**: Replace individual meshes with `THREE.InstancedMesh`, reducing draw calls from 180+ to <15.
- **Day/Night & Weather Lighting Synchronization**: Sync in-game skybox with user's real-time sunrise/sunset.

### 5.2 Companion Pets V2 (Tamagotchi Focus Mechanics)

**Location**: `artifacts/focusarx/src/components/Pet3D.tsx`, `artifacts/focusarx/src/pages/pets.tsx`

**Enhancements**:
- **Focus Synergy**: Pets gain energy, happiness, and evolution XP exclusively through verified study sessions.
- **Interactive Idle States**: Pets react in real-time with procedural animations.
- **Pet Accessories & Shaders**: Unlockable chromatic aura shaders, hats, and gems via the marketplace.

### 5.3 Forge Rooms & Real-Time Virtual Study Halls

**Location**: `artifacts/focusarx/src/pages/forge-room.tsx`, `artifacts/api-server/src/lib/socketManager.ts`

**Enhancements**:
- **WebRTC Ephemeral Audio / Co-Working Mesh**: Low-latency, noise-suppressed ambient co-working rooms.
- **Group Resonance Multipliers**: Dynamic XP multipliers (1.0× to 2.5×) based on concurrent room members in active focus.
- **Pomodoro Synchronization**: Room hosts can initiate synchronized sprints.

### 5.4 Cryptographically Verifiable "Proof-of-Work" Resume

**Location**: `artifacts/focusarx/src/pages/profile.tsx`, `publicProfiles.ts`

**Feature**:
- Generate exportable, digitally signed SVG certificates and PDF resumes.
- Public verification links showcasing tamper-proof discipline metrics.

---

## 6. Frontend, UI/UX, Design System & Mobile PWA

### 6.1 Refactoring Monolithic Components (Timer.tsx)

**Problem**: `artifacts/focusarx/src/components/Timer.tsx` exceeds 1,080 lines.

**Architecture Solution**: Decompose into modular components:

```
src/components/timer/
├── index.tsx                 # Root container
├── useTimerMachine.ts        # Finite state machine
├── TimerDial.tsx             # Canvas/SVG circular progress
├── TimerControls.tsx         # Play/pause/skip/reset buttons
├── TimerAura.tsx             # Ambient background glow shaders
├── SessionRitualModal.tsx    # Pre-session intention setting
├── ReflectionModal.tsx       # Post-session summary
└── BreakActivityCard.tsx     # Micro-break stretches & hydration
```

### 6.2 Progressive Web App (PWA) 2.0 & Offline-First Engine

**Location**: `artifacts/focusarx/public/manifest.json`, `public/sw.js`

**Enhancements**:
- **IndexedDB Local Storage Buffer**: Queue completed sessions locally; automatically replay when connectivity returns.
- **Web Push Notification Engine**: Standardize VAPID push for daily streak reminders, friend study alerts, and scheduled alarms.
- **iOS Standalone Tweaks**: Add `viewport-fit=cover`, safe-area-inset padding for iPhone Dynamic Island.

### 6.3 Accessibility (WCAG 2.2 AA) & Ergonomics

**Enhancements**:
- **Global Keyboard Navigation Matrix**: Space → Play/Pause, Alt+R → Reset, Alt+Z → Zen Mode, Cmd/Ctrl+K → Command Palette.
- **Screen Reader Live Regions**: `aria-live="polite"` to announce remaining minutes every 5 minutes.
- **High-Contrast & Colorblindness Themes**: Protanopia, Deuteranopia, and OLED Pure Black modes.

---

## 7. Backend, Database & Cloud Infrastructure

### 7.1 Database Indexing & Performance Tuning

**Location**: `lib/db/src/schema/focusarx.ts`, `platform.ts`, `analytics.ts`

**Optimizations**:
- Add compound indexes for high-frequency queries.
- Implement database table partitioning for `analytics_events` and `audit_logs` by month.

### 7.2 Distributed Redis Caching & Edge Rate Limiting

**Location**: `artifacts/api-server/src/lib/rateLimiter.ts`, `rateLimitStore.ts`

**Enhancements**:
- Connect Upstash Redis across all serverless API endpoints.
- Cache public leaderboard queries, community pulse stats, and store catalogs with 60s TTL.

### 7.3 Stripe / Polar Payment Webhook Engine

**Location**: `artifacts/api-server/src/routes/premium.ts`

**Enhancements**:
- Implement automated webhook handler (`POST /api/webhooks/stripe`) verifying signatures.
- Automatically provision premium on `customer.subscription.created` and revoke on `customer.subscription.deleted`.

---

## 8. Developer Experience (DX), Observability & CI/CD

### 8.1 Zero-Config Local Development with Docker Compose

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: focusarx
      POSTGRES_PASSWORD: focusarx_dev_password
      POSTGRES_DB: focusarx
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  mailhog:
    image: mailhog/mailhog:latest
    ports: ["1025:1025", "8025:8025"]
volumes:
  pgdata:
```

### 8.2 Production Observability & Sentry Error Tracing

- Add OpenTelemetry tracing / Sentry error tracking with sourcemaps.
- Track APM metrics: P95 API Latency, Session Sync Success Rate, WebGL Shader Compilation Times.

---

## 9. Comprehensive Phased Execution Roadmap

```
2026 ROADMAP TIMELINE
═════════════════════════════════════════════════════════════════════════════

WEEKS 1-2: HARDENING & STABILIZATION (P0)
├─ Web Worker Timer Drift Engine & AudioContext clock fallback
├─ Decompose Timer.tsx (1083 lines) into modular subcomponents
├─ Synchronize OpenAPI 3.0 spec (26 -> 75+ endpoints) & regenerate Orval hooks
└─ Database compound indexes, transaction locks & DB migration testing

WEEKS 3-4: SCIENTIFIC FOCUS CORE & PWA OFFLINE
├─ Web Audio Binaural Beats Synthesizer (Alpha, Theta, Beta, Gamma entrainment)
├─ IndexedDB offline session cache & background sync queue
├─ Cross-tab timer synchronization with BroadcastChannel API
└─ Fast Axe-Core accessibility prerender validation pipeline

WEEKS 5-6: ARX OS 2.0 & MULTIMODAL AI (Gemini + Groq)
├─ SSE streaming endpoints for sub-200ms real-time AI responses (Gemini primary)
├─ FSRS-4.5 Spaced Repetition Flashcard algorithm integration
├─ Multi-turn interactive Feynman technique tutor (Gemini-powered)
└─ Automatic 1-click AI Task Decomposition into 15m Pomodoros (Gemini-powered)

WEEKS 7-8: 3D CITY V2 & REALTIME FORGE ROOMS
├─ Three.js InstancedMesh optimization & Level of Detail (LOD) system
├─ WebRTC ephemeral audio co-working rooms with Group Resonance multipliers
├─ Day/Night weather lighting sync in 3D City
└─ Companion Pet evolution animations and emotion rigs

WEEKS 9-10: MONETIZATION, METRICS & PRODUCTION LAUNCH
├─ Stripe / Polar automated webhook checkout & subscription management
├─ Digitally signed "Proof-of-Work" productivity certificates
├─ Docker Compose zero-config developer onboarding
└─ Production deployment, Sentry tracing & global CDN caching

═════════════════════════════════════════════════════════════════════════════
```

---

## 10. Summary of Recommendations & Next Steps

1. **Immediate Execution**: Deploy the Web Worker timer fix and modularize Timer.tsx to eliminate background tab throttling and improve maintainability.
2. **Contract Alignment**: Run the OpenAPI schema generator to synchronize the full 75+ route API surface with typed React Query hooks.
3. **Feature Modernization**: Roll out SSE streaming for the AI coach (Gemini primary), Web Audio binaural beats, and FSRS spaced repetition.
4. **Scale & Monetization**: Connect transactional payment webhooks and distributed Redis caching to support high concurrent user loads.
