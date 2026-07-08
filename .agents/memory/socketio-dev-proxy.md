---
name: Socket.io dev proxy
description: Vite dev server must explicitly proxy /socket.io to the API server port with ws:true, or all socket connections timeout in development.
---

## Rule
Add a `/socket.io` proxy entry in `vite.config.ts` alongside the `/api` proxy, with `ws: true`.

```ts
proxy: {
  "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
  "/socket.io": { target: "http://127.0.0.1:8080", changeOrigin: true, ws: true },
}
```

**Why:** In dev, the frontend runs on port 20925 (Vite) and the API+Socket.io server runs on port 8080 (Express). The frontend connects socket.io to `window.location.origin` (port 20925). Without a proxy for `/socket.io`, the connection hits Vite which has no socket.io — every connection times out. In production (reverse proxy in front of both), `window.location.origin/socket.io` routes correctly to the API server.

**How to apply:** Any time socket.io is added to this project or the dev server is reconfigured, ensure both `/api` and `/socket.io` are proxied in `vite.config.ts`. Also confirm `ws: true` is set — without it, only HTTP polling works (no WebSocket upgrade).
