# FocusArx: Full Repository Transformation Plan (Fable 5 Standard)

This plan outlines the remaining steps to elevate FocusArx into a world-class "Deep Work OS" with elite SEO, premium UI, and robust technical foundations.

## Phase 1: Elite UI & UX (Visual Polish)
- [ ] **Global Theme Sync**: Ensure "Fable 5" aesthetic (3D, high-end glows, blur-ins) is consistent across all pages, including the Shop, Marketplace, and Profile.
- [ ] **Interactive Onboarding**: Redesign the onboarding flow (`/onboarding`) using the `Hero3D` asset to explain the "Deep Work" philosophy through interactive 3D milestones.
- [ ] **Enhanced Animations**: 
    - Implement the `BLUR_IN` variant for all page headings.
    - Add magnetic hover effects to all primary navigation items.
    - Add standard "Framer Motion" layout transitions between sub-tabs in Analytics.

## Phase 2: SEO & Brand Dominance
- [ ] **Dynamic Meta Previews**: Automate OG image generation (using an edge function) that includes the user's specific "Focus DNA" or "City Level" when sharing profiles.
- [ ] **High-Value Content Cluster**:
    - Build out 10+ SEO-optimized "Deep Work Guides" in the `/focus-guide` directory.
    - Implement a "Study Method Calculator" tool to drive organic search traffic for "best study method."
- [ ] **Schema Expansion**: Add `BreadcrumbList` and `Organization` schema to all public-facing routes.

## Phase 3: Technical Hardening (Type Safety & Fixes)
- [ ] **Remove Remaining `any` Types**: Systematically replace `any` in `dashboard.tsx`, `AnalyticsPage`, and the API client with the new interfaces in `gamification.ts` and `focus.ts`.
- [ ] **Vision Processor Upgrade**: 
    - Replace the `visionProcessor.ts` stub with a lightweight WASM-based MediaPipe implementation.
    - Add a "Privacy Mode" toggle that visually masks the camera feed while keeping tracking active.
- [ ] **API Resilience**: 
    - Standardize error handling in the `api-server`.
    - Implement `React Query` optimistic updates for habit toggling and building construction to make the app feel "instant."

## Phase 4: Feature Innovation (Client Acquisition)
- [ ] **AI Focus Buddy**: Introduce a 3D animated companion in the "Forge Room" that reacts in real-time to focus scores (calm when you focus, jittery when you drift).
- [ ] **Productivity DNA Export**: Allow users to export a "Professional Productivity PDF" summarizing their focus hours and stability—useful for students applying to internships or researchers.
- [ ] **Real-Time Group Synergies**: Implement shared multipliers in Study Rooms—if everyone in a room is in "Flow State," everyone gets a 1.5x XP boost.

## Phase 5: Performance & Scalability
- [ ] **Asset Optimization**: Compress 3D models and use KTX2 textures to reduce VRAM usage.
- [ ] **PWA / Mobile Native**:
    - Finalize the `sw.js` (Service Worker) for full offline timer support.
    - Add an "Install to Home Screen" prompt for mobile users to bypass browser address bars.
- [ ] **Server-Side Edge Caching**: Implement aggressive caching for static SEO pages like the Focus Guides and Pricing.

---

**Target Goal:** 100% Type Safety | <2s Initial Load | #1 Ranking for "AI Deep Work OS"
