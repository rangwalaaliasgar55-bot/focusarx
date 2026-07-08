---
name: authHeaders type pattern
description: How to write authHeaders() functions that avoid TypeScript TS2769 union-type errors on fetch() headers
---

## Rule
Always use the imperative `Record<string, string>` pattern for auth header helpers:

```ts
function authHeaders(): Record<string, string> {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}
```

**Why:** The ternary form `return t ? { Authorization: ... } : {}` returns a union type. TypeScript's `fetch()` overloads reject union types for `headers` with TS2769 "No overload matches this call". The imperative form always returns `Record<string, string>` which satisfies `HeadersInit`.

**How to apply:** Any time a new page/component builds its own authHeaders() helper, use this pattern. If grepping reveals the ternary form in existing files, replace it.
