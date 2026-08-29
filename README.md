<div align="center">

# FocusArx — The Deep Work OS 🧠

**A premium, AI-powered productivity platform** for students and professionals who want peak cognitive performance. FocusArx combines scientific study methodologies with immersive 3D gamification and real-time AI coaching.

[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)

</div>

## 🚀 Key Features

- **Adaptive Pomodoro Timer** — science-backed focus sessions tailored to your brain type.
- **AI Productivity Coach** — real-time voice coaching and neuroscience insights.
- **Interactive 3D Focus City** — watch your academic civilization grow as you complete sessions.
- **Forge Room** — collaborative live study rooms with "Group Resonance" multipliers.
- **Scientific Content Hub** — deep dives into the neuroscience of focus and rapid learning.
- **Productivity Resume** — export professional "Proof of Work" certificates for your discipline.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4.
- **3D Engine**: Three.js, React Three Fiber, React Three Drei.
- **Animation**: Framer Motion.
- **Backend**: Node.js, Express 5, Drizzle ORM, PostgreSQL (Neon).
- **AI Integration**: Gemini 2.5 Flash, Groq (optional — all AI features degrade gracefully without keys), MediaPipe (on-device vision).
- **Infrastructure**: Vercel (static frontend + serverless API), PWA-ready.

## 📦 Project Structure

```text
/
├── api/                    # Vercel serverless entry that mounts the API
├── artifacts/
│   ├── focusarx/           # Main frontend application (React + Vite)
│   └── api-server/         # Express API server (also runs standalone)
├── docs/                   # Developer documentation
│   └── ENVIRONMENT.md      # Full environment-variable reference
├── lib/
│   ├── db/                 # Drizzle schema, migrations, push tooling
│   ├── api-spec/           # OpenAPI spec + codegen config
│   ├── api-zod/            # Generated Zod API types
│   └── api-client-react/   # Generated typed React API client
└── tests/
    └── e2e/                # Playwright end-to-end tests
```

## 🏁 Getting Started

1. **Prerequisites**: Node.js 20+ and `pnpm` (`corepack enable`).
2. **Install dependencies**:
   ```bash
   pnpm install
   ```
3. **Set environment variables**: copy `.env.example` to `.env` and fill in what you need.
   Only `DATABASE_URL` and `AUTH_SECRET` are required to run; see
   [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for the complete reference.
4. **Launch the project**:
   ```bash
   pnpm run dev   # API on :8080, frontend on :5000 with /api proxy
   ```

## 🚀 Production deployment

Follow **[docs/PRODUCTION_SETUP.md](docs/PRODUCTION_SETUP.md)** for the full
step-by-step guide: Neon database, Vercel project + env vars, GitHub Actions
secrets, domain/DNS, admin user, and every manual task. The CI/CD definitions
live in **[docs/ci-workflows/](docs/ci-workflows/)** (`ci.yml` + `deploy.yml`);
copy them into `.github/workflows/` to activate (see the guide's §6). Once the
required secrets are set, pushes to `main` validate, migrate, deploy, and smoke
test automatically.

## ✅ Verifying Changes

```bash
pnpm typecheck   # tsc across all workspaces
pnpm test        # unit + contract tests (vitest)
pnpm build       # production builds for frontend, API and libs
```

## 📈 SEO & Growth

- **Master schema** — JSON-LD Organization, FAQ, Product and BreadcrumbList.
- **Build-time prerendering** — every public route ships with real meta tags and content.
- **PWA ready** — offline support with service workers and a mobile-first manifest.
- **Viral funnels** — Study Method Quiz and Volume Calculator lead magnets.

## 🛡️ Security

- **Neural Shield** — advanced bot mitigation and UA filtering.
- **Strict headers** — CSP, COOP/COEP, nosniff, frame DENY and XSS sanitization.
- **Private vision** — all webcam processing happens locally on-device.
- **Anti-cheat** — server-authoritative session timing, idempotent reward grants, budgeted AI calls.

See [SECURITY.md](SECURITY.md) for the vulnerability reporting policy.

## 🤝 Contributing

Open an [Issue](https://github.com/rangwalaaliasgar55-bot/focusarx/issues) or a [Pull Request](https://github.com/rangwalaaliasgar55-bot/focusarx/pulls). See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

MIT — see [LICENSE](LICENSE).

---

*Built for the world's most ambitious learners.*
