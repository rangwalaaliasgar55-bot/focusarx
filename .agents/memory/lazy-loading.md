---
name: Lazy loading pattern for App.tsx
description: How to correctly add React.lazy + Suspense in App.tsx without breaking HMR
---

## The rule
All `import` statements must come before any `const lazy(() => import(...))` declarations. Mixing them causes `PageLoader is not defined` runtime errors during HMR because Vite fires between sequential edits.

**Why:** ES module import statements are hoisted but `const` declarations are not. If you add lazy declarations in one edit and `import { lazy }` or a referenced component in another edit to the same file, HMR fires between them and the component is briefly undefined.

**How to apply:**
1. Move `import { lazy, Suspense }` to the very first React import line
2. Place all static `import` statements before any `const X = lazy(() => ...)`
3. Define `PageLoader` (or any Suspense fallback component) BEFORE the component that references it in JSX (`AppWithPalette` calls `<PageLoader />` in the `Suspense fallback`)
4. Wrap `<Switch>` with `<Suspense fallback={<PageLoader />}>` inside `AppWithPalette`
5. When making multiple related edits to the same file, do them in a single edit block if possible to avoid transient HMR states
