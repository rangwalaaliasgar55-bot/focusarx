# Focusarx

Focusarx is a deep-work companion for focused study sessions. It combines a Pomodoro-style timer, session recovery, focus history, streak tracking, task progress, optional camera-based focus monitoring, and AI-assisted coaching/roadmaps in a Next.js app that can also be packaged for Android with Capacitor.

## Features

- Focus, break, and long-break timer modes with custom durations
- Session persistence and recovery when a tab refreshes or the app restarts
- Guest and email/password authentication with Auth.js credentials
- Prisma-backed storage for users, tasks, goals, streaks, achievements, and focus sessions
- Dashboard with daily minutes, average focus score, stability, streaks, tasks completed, weekly focus time, and recent session cards
- Optional camera focus monitoring using TensorFlow/MediaPipe-powered browser APIs
- AI coach and 7-day roadmap endpoints with mock fallbacks when no OpenAI key is configured
- Admin area protected by an admin password and signed HTTP-only cookie
- Capacitor Android setup for running the web app as a mobile app

## Tech Stack

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS 4
- Prisma 6 with SQLite for local development
- Auth.js / NextAuth credentials authentication
- Framer Motion for UI transitions
- TensorFlow.js, COCO-SSD, MediaPipe Tasks Vision, and React Webcam for focus monitoring
- Capacitor 8 for Android packaging
- Zod for request validation

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- Android Studio if you want to run the Capacitor Android app

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Update `.env` with local values. For the default SQLite setup, this is enough:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-a-long-random-string"
ADMIN_PASSWORD="your-admin-password-here"
```

4. Create or update the Prisma database:

```bash
npm run db:push
```

5. Start the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma database connection string. Defaults to local SQLite, for example `file:./dev.db`. |
| `AUTH_SECRET` | Production | Auth.js signing secret. Local dev has a fallback, but production should always set this. |
| `ADMIN_PASSWORD` | For `/admin` | Password used to access the admin panel. |
| `ADMIN_SECRET` | No | Optional separate signing key for admin cookies. Falls back to `AUTH_SECRET`. |
| `OPENAI_API_KEY` | No | Enables real AI coach and roadmap responses. Routes use mock/fallback responses when omitted. |
| `CAPACITOR_SERVER_URL` | Android dev | Points the Android WebView at a dev or production server. |
| `CAPACITOR_WEBVIEW_DEBUG` | No | Enables WebView debugging when set to `true`. |

## Useful Scripts

```bash
npm run dev          # Generate Prisma client and run Next.js locally
npm run build        # Generate Prisma client and build the app
npm run start        # Start the production Next.js server
npm run lint         # Run ESLint
npm run db:push      # Push Prisma schema changes to the database
npm run db:sync      # Run the project Prisma sync helper
npm run db:fix       # Run the project migration helper
npm run cap:prepare  # Prepare static web output for Capacitor
npm run cap:sync     # Prepare web output and sync Android assets
npm run android:run  # Sync and run the Android app
```

## Android Notes

For Android emulator development, set:

```env
CAPACITOR_SERVER_URL=http://10.0.2.2:3000
CAPACITOR_WEBVIEW_DEBUG=true
```

For a physical Android device, use your computer's LAN IP:

```env
CAPACITOR_SERVER_URL=http://YOUR_COMPUTER_LAN_IP:3000
```

Then run:

```bash
npm run android:run
```

## Project Structure

```text
app/          Next.js routes, pages, layouts, and API endpoints
src/          Shared components, hooks, server helpers, types, and utilities
prisma/       Prisma schema and local SQLite database files
scripts/      Database and Capacitor helper scripts
android/      Capacitor Android project
public/       Static web assets
```

## Future Roadmap

- Add production OAuth providers alongside credentials and guest sessions
- Add richer task planning with recurring goals and calendar-aware scheduling
- Replace AI mock fallbacks with configurable model/provider settings
- Add exportable focus reports for weekly reviews
- Add automated tests for timer persistence, session sync, auth flows, and API validation
- Improve offline-first behavior for Android sessions and task updates

## License

No license has been specified yet.
